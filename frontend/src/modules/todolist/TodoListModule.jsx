import { useEffect, useState } from 'react';
import { createTodo, deleteTodo, listTodos, updateTodo } from '../../lib/api';

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

export default function TodoListModule({
  refreshSignal = 0,
  focusTimerStatus = null,
  onFocusTodo = () => {},
  onTodoDeleted = () => {},
} = {}) {
  const [todoInputValue, setTodoInputValue] = useState('');
  const [dailyTodos, setDailyTodos] = useState([]);
  const [status, setStatus] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [editingTodoId, setEditingTodoId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const todoDate = getTodayDate();

  const completedTodoCount = dailyTodos.filter((todo) => todo.completed).length;

  useEffect(() => {
    let isDisposed = false;

    setStatus('loading');
    listTodos(todoDate)
      .then((todos) => {
        if (isDisposed) {
          return;
        }

        setDailyTodos(todos);
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
  }, [todoDate, refreshSignal]);

  const handleAddTodo = async (event) => {
    event.preventDefault();

    const trimmedTitle = todoInputValue.trim();
    if (!trimmedTitle) {
      return;
    }

    try {
      const todo = await createTodo({ title: trimmedTitle, todoDate });
      setDailyTodos((currentTodos) => [todo, ...currentTodos]);
      setTodoInputValue('');
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '新增任务失败');
      setStatus('error');
    }
  };

  const handleToggleTodo = async (todoToToggle) => {
    const nextCompleted = !todoToToggle.completed;
    setDailyTodos((currentTodos) => currentTodos.map((todo) => (
      todo.id === todoToToggle.id ? { ...todo, completed: nextCompleted } : todo
    )));

    try {
      const savedTodo = await updateTodo(todoToToggle.id, { completed: nextCompleted });
      setDailyTodos((currentTodos) => currentTodos.map((todo) => (
        todo.id === savedTodo.id ? savedTodo : todo
      )));
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setDailyTodos((currentTodos) => currentTodos.map((todo) => (
        todo.id === todoToToggle.id ? todoToToggle : todo
      )));
      setErrorMessage(error instanceof Error ? error.message : '更新任务失败');
      setStatus('error');
    }
  };

  const handleDeleteTodo = async (todoId) => {
    const previousTodos = dailyTodos;
    setDailyTodos((currentTodos) => currentTodos.filter((todo) => todo.id !== todoId));
    onTodoDeleted(todoId);

    try {
      await deleteTodo(todoId);
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setDailyTodos(previousTodos);
      setErrorMessage(error instanceof Error ? error.message : '删除任务失败');
      setStatus('error');
    }
  };

  const handleStartEdit = (todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
    setErrorMessage('');
  };

  const handleCancelEdit = () => {
    setEditingTodoId(null);
    setEditingTitle('');
  };

  const handleSaveEdit = async (event, todoToEdit) => {
    event.preventDefault();

    const trimmedTitle = editingTitle.trim();
    if (!trimmedTitle || trimmedTitle === todoToEdit.title) {
      handleCancelEdit();
      return;
    }

    const previousTodos = dailyTodos;
    setDailyTodos((currentTodos) => currentTodos.map((todo) => (
      todo.id === todoToEdit.id ? { ...todo, title: trimmedTitle } : todo
    )));
    handleCancelEdit();

    try {
      const savedTodo = await updateTodo(todoToEdit.id, { title: trimmedTitle });
      setDailyTodos((currentTodos) => currentTodos.map((todo) => (
        todo.id === savedTodo.id ? savedTodo : todo
      )));
      setErrorMessage('');
      setStatus('ready');
    } catch (error) {
      setDailyTodos(previousTodos);
      setErrorMessage(error instanceof Error ? error.message : '编辑任务失败');
      setStatus('error');
    }
  };

  return (
    <section id="daily-todo-panel" className="daily-todo-panel" aria-label="每日 Todo">
      <div className="daily-todo-header">
        <div>
          <p className="daily-todo-kicker">Daily Todo</p>
          <h2>今日任务</h2>
        </div>
        <span className="daily-todo-count">{completedTodoCount} / {dailyTodos.length}</span>
      </div>

      <form className="daily-todo-form" onSubmit={handleAddTodo}>
        <label className="daily-todo-field">
          <span>新增任务</span>
          <input
            type="text"
            value={todoInputValue}
            onChange={(event) => setTodoInputValue(event.target.value)}
            placeholder="写下今天要完成的事"
          />
        </label>
        <button type="submit" className="primary-button daily-todo-add-button">
          添加
        </button>
      </form>

      {status === 'loading' ? <p className="daily-todo-state">任务加载中...</p> : null}
      {errorMessage ? <p className="daily-todo-error" role="alert">{errorMessage}</p> : null}

      <div className="daily-todo-list">
        {dailyTodos.map((todo) => {
          const isEditing = editingTodoId === todo.id;
          const isHabitTodo = todo.sourceType === 'habit';
          const isFocusTodo = String(focusTimerStatus?.todoId ?? '') === String(todo.id);
          const focusTimerLabel = isFocusTodo && focusTimerStatus?.phase === 'focus'
            ? formatTodoTimer(focusTimerStatus.remainingSeconds)
            : '';

          return (
            <div key={todo.id} className={`daily-todo-item ${todo.completed ? 'completed' : ''}`}>
              {isEditing ? (
                <form className="daily-todo-edit-form" onSubmit={(event) => handleSaveEdit(event, todo)}>
                  <input
                    aria-label="编辑任务标题"
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    autoFocus
                  />
                  <div className="daily-todo-edit-actions">
                    <button type="submit" className="daily-todo-text-button">保存</button>
                    <button type="button" className="daily-todo-text-button muted" onClick={handleCancelEdit}>
                      取消
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <label className="daily-todo-check">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo)}
                    />
                    <span className="daily-todo-title">
                      <span>{todo.title}</span>
                      <span className="daily-todo-badge-row">
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
                        onClick={() => handleStartEdit(todo)}
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
                </>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
