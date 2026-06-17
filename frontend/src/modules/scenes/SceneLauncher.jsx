import { useEffect, useRef, useState } from 'react';
import { createScene, deleteScene, listScenes, updateScene } from '../../lib/api';

const SCENE_COLOR_OPTIONS = [
  { value: '#4b8768', label: '森林绿' },
  { value: '#6f9fc7', label: '湖蓝' },
  { value: '#d89a5b', label: '暖橙' },
  { value: '#9b7bc3', label: '紫藤' },
  { value: '#c86f6f', label: '珊瑚红' },
  { value: '#7f8f55', label: '橄榄' },
];

function SceneIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 20 8v8l-8 5-8-5V8l8-5Zm0 2.4L6 9.15v5.7l6 3.75 6-3.75v-5.7l-6-3.75Z" fill="currentColor" />
      <path d="M12 8.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2Z" fill="currentColor" opacity=".48" />
    </svg>
  );
}

export default function SceneLauncher({ onScenesChanged = () => {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [editingScene, setEditingScene] = useState(null);
  const [title, setTitle] = useState('');
  const [color, setColor] = useState(SCENE_COLOR_OPTIONS[0].value);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleMouseDown = (event) => {
      if (panelRef.current?.contains(event.target)) return;
      setIsOpen(false);
      setEditingScene(null);
    };
    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let disposed = false;
    setStatus('loading');
    listScenes()
      .then((result) => {
        if (disposed) return;
        setScenes(result);
        setStatus('idle');
      })
      .catch((error) => {
        if (disposed) return;
        setErrorMessage(error instanceof Error ? error.message : '场景加载失败');
        setStatus('error');
      });
    return () => {
      disposed = true;
    };
  }, [isOpen]);

  const openCreate = () => {
    setEditingScene({ id: null });
    setTitle('');
    setColor(SCENE_COLOR_OPTIONS[0].value);
    setErrorMessage('');
  };

  const openEdit = (scene) => {
    setEditingScene(scene);
    setTitle(scene.title);
    setColor(scene.color || SCENE_COLOR_OPTIONS[0].value);
    setErrorMessage('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle) return;
    try {
      setStatus('saving');
      const scene = editingScene?.id
        ? await updateScene(editingScene.id, { title: nextTitle, color })
        : await createScene({ title: nextTitle, color });
      setScenes((items) => [scene, ...items.filter((item) => item.id !== scene.id)]);
      setEditingScene(null);
      setTitle('');
      setColor(SCENE_COLOR_OPTIONS[0].value);
      setStatus('idle');
      onScenesChanged();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存场景失败');
      setStatus('error');
    }
  };

  const handleDelete = async (sceneId) => {
    const previous = scenes;
    setScenes((items) => items.filter((scene) => scene.id !== sceneId));
    try {
      await deleteScene(sceneId);
      onScenesChanged();
    } catch (error) {
      setScenes(previous);
      setErrorMessage(error instanceof Error ? error.message : '删除场景失败');
    }
  };

  return (
    <div className="scene-launcher" ref={panelRef}>
      {isOpen ? (
        <section className="habit-panel scene-panel" role="dialog" aria-label="专注场景面板">
          <div className="habit-panel-header">
            <p className="habit-panel-title">专注场景</p>
            <p className="habit-panel-subtitle">管理计时可绑定的场景。</p>
          </div>
          {errorMessage ? <p className="habit-error" role="alert">{errorMessage}</p> : null}
          <div className="habit-list" aria-label="当前场景">
            {status === 'loading' ? <p className="habit-state">场景加载中...</p> : null}
            {scenes.map((scene) => (
              <div className="habit-item" key={scene.id}>
                <div className="habit-item-actions-left">
                  <button type="button" className="habit-icon-button" aria-label={`编辑场景 ${scene.title}`} onClick={() => openEdit(scene)}>改</button>
                  <button type="button" className="habit-icon-button danger" aria-label={`删除场景 ${scene.title}`} onClick={() => handleDelete(scene.id)}>删</button>
                </div>
                <div className="habit-item-copy">
                  <span className="habit-item-title scene-item-title">
                    <span className="scene-color-dot" style={{ '--scene-color': scene.color || SCENE_COLOR_OPTIONS[0].value }} aria-hidden="true" />
                    {scene.title}
                  </span>
                  <span className="habit-item-range">可绑定到专注计时</span>
                </div>
              </div>
            ))}
            {status !== 'loading' && scenes.length === 0 ? <p className="habit-state">还没有场景</p> : null}
          </div>
          <button type="button" className="primary-button habit-new-button" onClick={openCreate}>新建场景</button>
        </section>
      ) : null}

      {isOpen && editingScene ? (
        <section className="habit-editor-panel scene-editor-panel" role="dialog" aria-label={editingScene.id ? '编辑场景' : '创建场景'}>
          <div className="habit-panel-header">
            <p className="habit-panel-title">{editingScene.id ? '编辑场景' : '新建场景'}</p>
            <p className="habit-panel-subtitle">例如运动、阅读、写作。</p>
          </div>
          <form className="habit-form" onSubmit={handleSubmit}>
            <label className="habit-field">
              <span>场景名称</span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如 运动" />
            </label>
            <fieldset className="scene-color-field">
              <legend>场景颜色</legend>
              <div className="scene-color-options">
                {SCENE_COLOR_OPTIONS.map((option) => (
                  <label key={option.value} className="scene-color-option" title={option.label}>
                    <input
                      type="radio"
                      name="scene-color"
                      value={option.value}
                      checked={color === option.value}
                      onChange={(event) => setColor(event.target.value)}
                    />
                    <span style={{ '--scene-color': option.value }}>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="habit-editor-actions">
              <button type="submit" className="primary-button habit-submit-button" disabled={status === 'saving'}>保存</button>
              <button type="button" className="ghost-button habit-submit-button" onClick={() => setEditingScene(null)}>取消</button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className={`habit-launcher-button has-tooltip ${isOpen ? 'active' : ''}`}
        aria-label="打开场景面板"
        aria-pressed={isOpen}
        data-tooltip="专注场景"
        onClick={() => setIsOpen((open) => !open)}
      >
        <SceneIcon />
      </button>
    </div>
  );
}
