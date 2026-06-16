import { useEffect, useState } from 'react';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../../lib/api';

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低', tone: 'low' },
  { value: 'medium', label: '中', tone: 'medium' },
  { value: 'high', label: '高', tone: 'high' },
];

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatTodoTimer(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = Math.max(0, seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function formatFocusDuration(seconds) {
  if (!seconds) {
    return '';
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getPriorityLabel(priority) {
  return PRIORITY_OPTIONS.find((option) => option.value === priority)?.label ?? '中';
}

function getDueLabel(todoDate) {
  return todoDate === getTodayDate() ? '今日' : `截止 ${todoDate}`;
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 16.75V19h2.25l8.85-8.85-2.25-2.25L5 16.75Zm12.82-8.37a1.2 1.2 0 0 0 0-1.7l-.5-.5a1.2 1.2 0 0 0-1.7 0l-.94.94 2.25 2.25.89-.99Z" fill="currentColor" />
    </svg>
  );
}

function TimerIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6v2H9V3Zm2 9V7h2v6h-2Zm1 9a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm0-2a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm5.66-11.95 1.41-1.41 1.41 1.41-1.41 1.41-1.41-1.41Z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 10.2A2 2 0 0 1 14.31 21H9.69a2 2 0 0 1-1.99-1.8L7 9Zm3 2v7h2v-7h-2Zm4 0v7h2v-7h-2Z" fill="currentColor" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 21V4.8c3.7-1.9 6.3 1.2 10 0 .7-.2 1.4-.5 2-.8v9.2c-.6.4-1.3.6-2 .8-3.7 1.2-6.3-1.9-10 0" fill="currentColor" />
    </svg>
  );
}

function TodoTaskModal({
  mode,
  initialValues,
  onClose,
  onSubmit,
} = {}) {
  const [title, setTitle] = useState(initialValues.title);
  const [todoDate, setTodoDate] = useState(initialValues.todoDate);
  const [priority, setPriority] = useState(initialValues.priority);
  const isEditMode = mode === 'edit';

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      todoDate,
      priority,
    });
  };

  return (
    <div className="task-modal-backdrop" role="presentation">
      <section className="task-modal" role="dialog" aria-label={isEditMode ? '编辑任务' : '新增任务'}>
        <div className="task-modal-header">
          <p>{isEditMode ? '编辑任务' : '新增任务'}</p>
          <button type="button" className="task-modal-close" aria-label="关闭任务窗口" onClick={onClose}>
            ×
          </button>
        </div>

        <form className="task-modal-form" onSubmit={handleSubmit}>
          <label className="task-modal-field">
            <span>任务名称</span>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="写下要完成的事"
              autoFocus
              required
            />
          </label>

          <label className="task-modal-field">
            <span>完成日期</span>
            <input
              type="date"
              value={todoDate}
              onChange={(event) => setTodoDate(event.target.value)}
              required
            />
          </label>

          <fieldset className="task-priority-field">
            <legend>紧急程度</legend>
            <div className="task-priority-options">
              {PRIORITY_OPTIONS.map((option) => (
                <label key={option.value} className={`task-priority-option ${option.tone}`}>
                  <input
                    type="radio"
                    name="task-priority"
                    value={option.value}
                    checked={priority === option.value}
                    onChange={(event) => setPriority(event.target.value)}
                  />
                  <span><FlagIcon />{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="task-modal-actions">
            <button type="button" className="daily-todo-text-button muted" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="primary-button task-modal-submit">
              {isEditMode ? '保存' : '添加'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default function TodoListModule({
  refreshSignal = 0,
  focusTimerStatus = null,
  onFocusTodo = () => {},
  onTodoDeleted = () => {},
} = {}) {
  const [taskTodos, setTaskTodos] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [taskModal, setTaskModal] = useState(null);

  useEffect(() => {
    let isDisposed = false;

    setStatus('loading');
    listTodos()
      .then((todos) => {
        if (isDisposed) {
          return;
        }

        setTaskTodos(todos);
        setStatus('ready');
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }
        setErrorMessage(error instanceof Error ? error.message : '任务加载失败');
        setStatus('error');
      });

    return () => {
      isDisposed = true;
    };
  }, [refreshSignal]);

  const openCreateModal = () => {
    setTaskModal({
      mode: 'create',
      todo: null,
      values: {
        title: '',
        todoDate: getTodayDate(),
        priority: 'medium',
      },
    });
    setErrorMessage('');
  };

  const openEditModal = (todo) => {
    setTaskModal({
      mode: 'edit',
      todo,
      values: {
        title: todo.title,
        todoDate: todo.todoDate,
        priority: todo.priority ?? 'medium',
      },
    });
    setErrorMessage('');
  };

  const closeTaskModal = () => {
    setTaskModal(null);
  };

  const handleSubmitTaskModal = async (values) => {
    if (!values.title) {
      return;
    }

    try {
      if (taskModal.mode === 'create') {
        const todo = await createTodo(values);
        setTaskTodos((currentTodos) => [todo, ...currentTodos]);
      } else {
        const previousTodo = taskModal.todo;
        const savedTodo = await updateTodo(previousTodo.id, values);
        setTaskTodos((currentTodos) => currentTodos.map((todo) => (
          todo.id === savedTodo.id ? savedTodo : todo
        )));
      }

      closeTaskModal();
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '任务保存失败');
      setStatus('error');
    }
  };

  const handleToggleTodo = async (todoToToggle) => {
    const previousTodos = taskTodos;
    setTaskTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoToToggle.id));

    try {
      await updateTodo(todoToToggle.id, { completed: true });
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setTaskTodos(previousTodos);
      setErrorMessage(error instanceof Error ? error.message : '更新任务失败');
      setStatus('error');
    }
  };

  const handleDeleteTodo = async (todoId) => {
    const previousTodos = taskTodos;
    setTaskTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
    onTodoDeleted(todoId);

    try {
      await deleteTodo(todoId);
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setTaskTodos(previousTodos);
      setErrorMessage(error instanceof Error ? error.message : '删除任务失败');
      setStatus('error');
    }
  };

  return (
    <section id="daily-todo-panel" className="daily-todo-panel" aria-label="任务清单">
      <div className="daily-todo-header">
        <div>
          <p className="daily-todo-kicker">Task List</p>
          <h2>任务清单</h2>
        </div>
        <span className="daily-todo-count">{taskTodos.length} 项</span>
      </div>

      <button type="button" className="primary-button daily-todo-add-button" onClick={openCreateModal}>
        新增任务
      </button>

      {status === 'loading' ? <p className="daily-todo-state">任务加载中...</p> : null}
      {errorMessage ? <p className="daily-todo-error" role="alert">{errorMessage}</p> : null}

      <div className="daily-todo-list">
        {taskTodos.map((todo) => {
          const isHabitTodo = todo.sourceType === 'habit';
          const priority = todo.priority ?? 'medium';
          const isFocusTodo = String(focusTimerStatus?.todoId ?? '') === String(todo.id);
          const focusTimerLabel = isFocusTodo && focusTimerStatus?.phase === 'focus'
            ? formatTodoTimer(focusTimerStatus.remainingSeconds)
            : '';

          return (
            <div key={todo.id} className="daily-todo-item">
              <label className="daily-todo-check">
                <input
                  type="checkbox"
                  aria-label={todo.title}
                  checked={false}
                  onChange={() => handleToggleTodo(todo)}
                />
                <span className="daily-todo-title">
                  <span>{todo.title}</span>
                  <span className="daily-todo-badge-row">
                    <span className="daily-todo-date-badge">{getDueLabel(todo.todoDate)}</span>
                    <span className={`daily-todo-priority-badge ${priority}`}>
                      <FlagIcon />{getPriorityLabel(priority)}
                    </span>
                    {isHabitTodo ? <span className="daily-todo-badge">习惯</span> : null}
                    {todo.focusSeconds > 0 ? (
                      <span className="daily-todo-focus-badge">已专注 {formatFocusDuration(todo.focusSeconds)}</span>
                    ) : null}
                  </span>
                </span>
              </label>
              <div className="daily-todo-actions" aria-label={`${todo.title} 操作`}>
                {!isHabitTodo ? (
                  <button
                    type="button"
                    className="daily-todo-icon-button has-tooltip"
                    aria-label={`编辑任务 ${todo.title}`}
                    data-tooltip="编辑"
                    onClick={() => openEditModal(todo)}
                  >
                    <EditIcon />
                  </button>
                ) : null}
                <button
                  type="button"
                  className={`daily-todo-icon-button timer has-tooltip ${focusTimerLabel ? 'active-timer' : ''}`}
                  aria-label={`开始计时 ${todo.title}`}
                  data-tooltip={focusTimerLabel ? '当前专注' : '计时'}
                  onClick={() => onFocusTodo(todo)}
                >
                  {focusTimerLabel ? <span className="daily-todo-timer-label">{focusTimerLabel}</span> : <TimerIcon />}
                </button>
                {!isHabitTodo ? (
                  <button
                    type="button"
                    className="daily-todo-icon-button danger has-tooltip"
                    aria-label={`删除任务 ${todo.title}`}
                    data-tooltip="删除"
                    onClick={() => handleDeleteTodo(todo.id)}
                  >
                    <TrashIcon />
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {taskModal ? (
        <TodoTaskModal
          mode={taskModal.mode}
          initialValues={taskModal.values}
          onClose={closeTaskModal}
          onSubmit={handleSubmitTaskModal}
        />
      ) : null}
    </section>
  );
}
