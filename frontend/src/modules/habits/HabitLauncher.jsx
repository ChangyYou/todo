import { useEffect, useRef, useState } from 'react';
import { createHabit, deleteHabit, listHabits, updateHabit } from '../../lib/api';

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function HabitIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3.5c3.9 2.12 6.5 5.46 6.5 9.08 0 4.06-2.9 7.92-6.5 7.92s-6.5-3.86-6.5-7.92c0-3.62 2.6-6.96 6.5-9.08Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.2 12.35 11.2 14.3l3.85-4.35" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 16.9 15.8 5.6a2.1 2.1 0 0 1 3 3L7.5 19.9l-3.8.6.8-3.6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 7h14M9 7V5.5h6V7m-8 0 .7 12h8.6L17 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function mergeHabitByID(habits, habit) {
  return [
    habit,
    ...habits.filter((item) => item.id !== habit.id),
  ];
}

function createFormState(habit = null) {
  return {
    id: habit?.id ?? null,
    title: habit?.title ?? '',
    startDate: habit?.startDate ?? getTodayDate(),
    endDate: habit?.endDate ?? '',
    neverEnds: !habit?.endDate,
  };
}

function formatHabitRange(habit) {
  return `${habit.startDate} - ${habit.endDate ?? '永久'}`;
}

export default function HabitLauncher({ onHabitCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editorMode, setEditorMode] = useState(null);
  const [formState, setFormState] = useState(createFormState());
  const [habits, setHabits] = useState([]);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) {
        return;
      }
      setIsOpen(false);
      setEditorMode(null);
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isDisposed = false;

    setStatus('loading');
    listHabits()
      .then((result) => {
        if (isDisposed) {
          return;
        }
        setHabits(result);
        setStatus('idle');
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '习惯加载失败');
        setStatus('error');
      });

    return () => {
      isDisposed = true;
    };
  }, [isOpen]);

  const openCreatePanel = () => {
    setFormState(createFormState());
    setEditorMode('create');
    setErrorMessage('');
    setStatus('idle');
  };

  const openEditPanel = (habit) => {
    setFormState(createFormState(habit));
    setEditorMode('edit');
    setErrorMessage('');
    setStatus('idle');
  };

  const closeEditor = () => {
    setEditorMode(null);
    setFormState(createFormState());
  };

  const handleFormChange = (field, value) => {
    setFormState((current) => ({ ...current, [field]: value }));
  };

  const handleToggleNeverEnds = () => {
    setFormState((current) => ({
      ...current,
      neverEnds: !current.neverEnds,
      endDate: current.neverEnds ? current.endDate : '',
    }));
  };

  const handleSubmitHabit = async (event) => {
    event.preventDefault();

    const title = formState.title.trim();
    if (!title) {
      return;
    }

    const payload = {
      title,
      startDate: formState.startDate,
      endDate: formState.neverEnds ? '' : formState.endDate,
    };

    try {
      setStatus('saving');
      const habit = editorMode === 'edit'
        ? await updateHabit(formState.id, payload)
        : await createHabit(payload);

      setHabits((currentHabits) => mergeHabitByID(currentHabits, habit));
      setErrorMessage('');
      setStatus('saved');
      closeEditor();
      onHabitCreated?.();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '保存习惯失败');
      setStatus('error');
    }
  };

  const handleDeleteHabit = async (habitID) => {
    const previousHabits = habits;
    setHabits((currentHabits) => currentHabits.filter((habit) => habit.id !== habitID));

    try {
      await deleteHabit(habitID);
      setErrorMessage('');
      setStatus('idle');
      onHabitCreated?.();
    } catch (error) {
      setHabits(previousHabits);
      setErrorMessage(error instanceof Error ? error.message : '删除习惯失败');
      setStatus('error');
    }
  };

  return (
    <div className="habit-launcher" ref={panelRef}>
      {isOpen ? (
        <section className="habit-panel" role="dialog" aria-label="每日习惯面板">
          <div className="habit-panel-header">
            <p className="habit-panel-title">每日习惯</p>
            <p className="habit-panel-subtitle">管理会出现在今日任务里的习惯。</p>
          </div>

          {errorMessage ? <p className="habit-error" role="alert">{errorMessage}</p> : null}

          <div className="habit-list" aria-label="当前习惯">
            {status === 'loading' ? <p className="habit-state">习惯加载中...</p> : null}
            {habits.map((habit) => (
              <div className="habit-item" key={habit.id}>
                <div className="habit-item-actions-left">
                  <button type="button" className="habit-icon-button" aria-label={`编辑习惯 ${habit.title}`} onClick={() => openEditPanel(habit)}>
                    <EditIcon />
                  </button>
                  <button type="button" className="habit-icon-button danger" aria-label={`删除习惯 ${habit.title}`} onClick={() => handleDeleteHabit(habit.id)}>
                    <TrashIcon />
                  </button>
                </div>
                <div className="habit-item-copy">
                  <span className="habit-item-title">{habit.title}</span>
                  <span className="habit-item-range">{formatHabitRange(habit)}</span>
                </div>
              </div>
            ))}
            {status !== 'loading' && habits.length === 0 ? (
              <p className="habit-state">还没有习惯</p>
            ) : null}
          </div>

          <button type="button" className="primary-button habit-new-button" onClick={openCreatePanel}>
            新建习惯
          </button>
        </section>
      ) : null}

      {isOpen && editorMode ? (
        <section className="habit-editor-panel" role="dialog" aria-label={editorMode === 'edit' ? '编辑习惯' : '创建习惯'}>
          <div className="habit-panel-header">
            <p className="habit-panel-title">{editorMode === 'edit' ? '编辑习惯' : '新建习惯'}</p>
            <p className="habit-panel-subtitle">设置习惯周期，结束为永久时不会自动过期。</p>
          </div>

          <form className="habit-form" onSubmit={handleSubmitHabit}>
            <label className="habit-field">
              <span>习惯内容</span>
              <input
                type="text"
                value={formState.title}
                onChange={(event) => handleFormChange('title', event.target.value)}
                placeholder="例如 运动30分钟"
              />
            </label>

            <label className="habit-field">
              <span>开始时间</span>
              <input
                type="date"
                value={formState.startDate}
                onChange={(event) => handleFormChange('startDate', event.target.value)}
              />
            </label>

            <label className="habit-never-field">
              <input
                type="checkbox"
                checked={formState.neverEnds}
                onChange={handleToggleNeverEnds}
              />
              <span>结束时间为永久</span>
            </label>

            <label className="habit-field">
              <span>结束时间</span>
              <input
                type="date"
                value={formState.endDate}
                disabled={formState.neverEnds}
                onChange={(event) => handleFormChange('endDate', event.target.value)}
              />
            </label>

            <div className="habit-editor-actions">
              <button type="submit" className="primary-button habit-submit-button" disabled={status === 'saving'}>
                {status === 'saving' ? '保存中' : '保存'}
              </button>
              <button type="button" className="ghost-button habit-submit-button" onClick={closeEditor}>
                取消
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className={`habit-launcher-button has-tooltip ${isOpen ? 'active' : ''}`}
        aria-label={isOpen ? '关闭习惯面板' : '打开习惯面板'}
        data-tooltip={isOpen ? '关闭习惯' : '习惯'}
        onClick={() => {
          setIsOpen((current) => !current);
          setEditorMode(null);
        }}
      >
        <HabitIcon />
      </button>
    </div>
  );
}
