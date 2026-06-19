import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../../lib/api';

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低', tone: 'low' },
  { value: 'medium', label: '中', tone: 'medium' },
  { value: 'high', label: '高', tone: 'high' },
];

const TASK_FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今日' },
  { value: 'tomorrow', label: '明天' },
  { value: 'upcoming', label: '近期' },
  { value: 'completed', label: '已完成' },
];

function getTodayDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(dateValue, offset) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isTodoInDate(todo, dateValue) {
  const startDate = todo.startDate || todo.todoDate;
  const endDate = todo.endDate || todo.todoDate || startDate;
  return startDate <= dateValue && endDate >= dateValue;
}

function isTodoUpcoming(todo, todayDate) {
  const tomorrow = addDays(todayDate, 1);
  const rangeEnd = addDays(todayDate, 7);
  const startDate = todo.startDate || todo.todoDate;
  const endDate = todo.endDate || todo.todoDate || startDate;
  return endDate >= tomorrow && startDate <= rangeEnd;
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

function getPriorityText(priority) {
  return `${getPriorityLabel(priority)}优先级`;
}

function getDueLabel(todoDate) {
  return todoDate === getTodayDate() ? '今日' : `截止 ${todoDate}`;
}

function getTodoTimeLabel(todo) {
  if (todo.timeType === 'moment') {
    const dateLabel = todo.startDate === getTodayDate() ? '今日' : todo.startDate;
    const timeLabel = todo.endTime && todo.endTime !== todo.startTime ? `${todo.startTime}-${todo.endTime}` : todo.startTime;
    return `${dateLabel} ${timeLabel}`;
  }
  if (todo.startDate && todo.endDate && todo.startDate !== todo.endDate) {
    return `${todo.startDate} 至 ${todo.endDate}`;
  }
  return getDueLabel(todo.startDate || todo.todoDate);
}

function getFilterCount(todos, filter, todayDate) {
  return todos.filter((todo) => matchesFilter(todo, filter, todayDate)).length;
}

function matchesFilter(todo, filter, todayDate) {
  if (filter === 'completed') {
    return todo.completed;
  }
  if (todo.completed) {
    return false;
  }
  if (filter === 'today') {
    return isTodoInDate(todo, todayDate);
  }
  if (filter === 'tomorrow') {
    return isTodoInDate(todo, addDays(todayDate, 1));
  }
  if (filter === 'upcoming') {
    return isTodoUpcoming(todo, todayDate);
  }
  return true;
}

function getFilterHeading(filter, todayDate) {
  switch (filter) {
    case 'today':
      return `今天 ${todayDate}`;
    case 'tomorrow':
      return `明天 ${addDays(todayDate, 1)}`;
    case 'upcoming':
      return '近期 7 天';
    case 'completed':
      return '已完成';
    default:
      return '待办事项';
  }
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

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z" fill="currentColor" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm5 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Zm5 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z" fill="currentColor" />
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
  const [timeType, setTimeType] = useState(initialValues.timeType);
  const [startDate, setStartDate] = useState(initialValues.startDate);
  const [endDate, setEndDate] = useState(initialValues.endDate);
  const [startTime, setStartTime] = useState(initialValues.startTime);
  const [endTime, setEndTime] = useState(initialValues.endTime);
  const [priority, setPriority] = useState(initialValues.priority);
  const isEditMode = mode === 'edit';

  const handleSubmit = (event) => {
    event.preventDefault();
    onSubmit({
      title: title.trim(),
      todoDate: startDate,
      timeType,
      startDate,
      endDate: timeType === 'moment' ? startDate : endDate,
      startTime: timeType === 'moment' ? startTime : '',
      endTime: timeType === 'moment' ? endTime : '',
      priority,
    });
  };

  return createPortal(
    <div className="task-modal-backdrop" role="presentation">
      <section
        className="task-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditMode ? '编辑任务' : '新增任务'}
      >
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

          <fieldset className="task-priority-field">
            <legend>时间类型</legend>
            <div className="task-priority-options task-time-options">
              <label className="task-priority-option">
                <input type="radio" name="task-time-type" value="date_range" checked={timeType === 'date_range'} onChange={() => setTimeType('date_range')} />
                <span>周期内</span>
              </label>
              <label className="task-priority-option">
                <input type="radio" name="task-time-type" value="moment" checked={timeType === 'moment'} onChange={() => setTimeType('moment')} />
                <span>某一时刻</span>
              </label>
            </div>
          </fieldset>

          {timeType === 'moment' ? (
            <div className="task-modal-grid">
              <label className="task-modal-field">
                <span>日期</span>
                <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
              </label>
              <label className="task-modal-field">
                <span>开始时间</span>
                <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
              </label>
              <label className="task-modal-field">
                <span>结束时间</span>
                <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
              </label>
            </div>
          ) : (
            <div className="task-modal-grid">
              <label className="task-modal-field">
                <span>开始日期</span>
                <input type="date" value={startDate} onChange={(event) => {
                  setStartDate(event.target.value);
                  if (endDate < event.target.value) {
                    setEndDate(event.target.value);
                  }
                }} required />
              </label>
              <label className="task-modal-field">
                <span>结束日期</span>
                <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
              </label>
            </div>
          )}

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
    </div>,
    document.body,
  );
}

export default function TodoListModule({
  refreshSignal = 0,
  focusTimerStatus = null,
  onFocusTodo = () => {},
  onTodoDeleted = () => {},
  onTodoCompleted = () => {},
} = {}) {
  const [taskTodos, setTaskTodos] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [taskModal, setTaskModal] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const todayDate = getTodayDate();
  const visibleTodos = taskTodos.filter((todo) => matchesFilter(todo, activeFilter, todayDate));
  const activeTodoCount = taskTodos.filter((todo) => !todo.completed).length;

  useEffect(() => {
    let isDisposed = false;

    setStatus('loading');
    listTodos({ status: 'all' })
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
        timeType: 'date_range',
        startDate: getTodayDate(),
        endDate: getTodayDate(),
        startTime: '09:00',
        endTime: '10:00',
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
        timeType: todo.timeType ?? 'date_range',
        startDate: todo.startDate ?? todo.todoDate,
        endDate: todo.endDate ?? todo.todoDate,
        startTime: todo.startTime || '09:00',
        endTime: todo.endTime || '10:00',
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
        setActiveFilter('all');
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
    const nextCompleted = !todoToToggle.completed;
    setTaskTodos((currentTodos) => currentTodos.map((todo) => (
      todo.id === todoToToggle.id ? { ...todo, completed: nextCompleted } : todo
    )));
    if (nextCompleted) {
      onTodoCompleted(todoToToggle.id);
    }

    try {
      await updateTodo(todoToToggle.id, { completed: nextCompleted });
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
    <section id="daily-todo-panel" className="daily-todo-panel" aria-label="待办事项">
      <div className="daily-todo-header">
        <div>
          <h2>待办事项</h2>
        </div>
        <div className="daily-todo-header-actions">
          <button type="button" className="daily-todo-mini-button has-tooltip" aria-label="切换任务显示" data-tooltip="列表视图">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 7h2v2H5V7Zm4 0h10v2H9V7Zm-4 4h2v2H5v-2Zm4 0h10v2H9v-2Zm-4 4h2v2H5v-2Zm4 0h10v2H9v-2Z" fill="currentColor" />
            </svg>
          </button>
          <button type="button" className="daily-todo-mini-button has-tooltip" aria-label="更多任务操作" data-tooltip="更多">
            <MoreIcon />
          </button>
        </div>
      </div>

      <div className="daily-todo-filter-tabs" role="tablist" aria-label="任务筛选">
        {TASK_FILTERS.map((filter) => {
          const count = getFilterCount(taskTodos, filter.value, todayDate);
          return (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={activeFilter === filter.value}
              className={activeFilter === filter.value ? 'active' : ''}
              onClick={() => setActiveFilter(filter.value)}
            >
              {filter.label}
              {count > 0 ? <span>{count}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="daily-todo-section-line">
        <span>{getFilterHeading(activeFilter, todayDate)}</span>
        <small>{activeFilter === 'completed' ? `${visibleTodos.length} 个已完成` : `${activeTodoCount} 个待办`}</small>
      </div>

      <button type="button" className="daily-todo-inline-add" onClick={openCreateModal}>
        <PlusIcon />
        <span>添加任务</span>
      </button>

      {status === 'loading' ? <p className="daily-todo-state">任务加载中...</p> : null}
      {errorMessage ? <p className="daily-todo-error" role="alert">{errorMessage}</p> : null}

      <div className="daily-todo-list">
        {visibleTodos.map((todo) => {
          const isHabitTodo = todo.sourceType === 'habit';
          const priority = todo.priority ?? 'medium';
          const isFocusTodo = String(focusTimerStatus?.todoId ?? '') === String(todo.id);
          const focusTimerLabel = isFocusTodo && focusTimerStatus?.phase === 'focus'
            ? formatTodoTimer(focusTimerStatus.remainingSeconds)
            : '';

          return (
            <div key={todo.id} className={`daily-todo-item ${todo.completed ? 'completed' : ''}`}>
              <div className="daily-todo-check">
                <input
                  type="checkbox"
                  aria-label={todo.completed ? `恢复任务 ${todo.title}` : `完成任务 ${todo.title}`}
                  checked={todo.completed}
                  onChange={() => handleToggleTodo(todo)}
                />
                <span className="daily-todo-title">
                  <span>{todo.title}</span>
                </span>
              </div>
              <div className="daily-todo-badge-row">
                <span className="daily-todo-date-badge">{getTodoTimeLabel(todo)}</span>
                <span className={`daily-todo-priority-badge ${priority}`}>
                  <FlagIcon />{getPriorityText(priority)}
                </span>
                {isHabitTodo ? <span className="daily-todo-badge">习惯</span> : null}
                {todo.focusSeconds > 0 ? (
                  <span className="daily-todo-focus-badge">已专注 {formatFocusDuration(todo.focusSeconds)}</span>
                ) : null}
              </div>
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
                  disabled={todo.completed}
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
        {status === 'ready' && visibleTodos.length === 0 ? (
          <p className="daily-todo-empty">{activeFilter === 'completed' ? '还没有已完成任务。' : '这个视图下还没有任务。'}</p>
        ) : null}
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
