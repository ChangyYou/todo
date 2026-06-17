import { useCallback, useRef, useState } from 'react';

import { logout } from '../../lib/api';
import HabitLauncher from '../../modules/habits/HabitLauncher';
import PomodoroPage from '../../modules/pomodoro/PomodoroPage';
import SceneLauncher from '../../modules/scenes/SceneLauncher';
import TodoListModule from '../../modules/todolist/TodoListModule';

export default function HomePage({ user, onLoggedOut }) {
  const [isTodoDrawerOpen, setIsTodoDrawerOpen] = useState(true);
  const [todoRefreshSignal, setTodoRefreshSignal] = useState(0);
  const [focusTodoRequest, setFocusTodoRequest] = useState(null);
  const [focusTimerStatus, setFocusTimerStatus] = useState(null);
  const [unbindFocusSignal, setUnbindFocusSignal] = useState(0);
  const [completeFocusSignal, setCompleteFocusSignal] = useState(null);
  const [sceneRefreshSignal, setSceneRefreshSignal] = useState(0);
  const focusTodoIdRef = useRef('');
  const pomodoroRef = useRef(null);

  const handleLogout = async () => {
    try {
      await pomodoroRef.current?.flushCurrentFocusDuration?.();
    } catch {
      // Logging out should not trap the user if the last focus segment cannot be saved.
    }
    await logout();
    onLoggedOut();
  };

  const handleFocusTodo = (todo) => {
    focusTodoIdRef.current = String(todo.id);
    setFocusTodoRequest({
      id: todo.id,
      title: todo.title,
      sourceType: todo.sourceType,
      stamp: Date.now(),
    });
  };

  const handleTodoDeleted = (todoId) => {
    if (focusTodoIdRef.current === String(todoId)) {
      focusTodoIdRef.current = '';
      setUnbindFocusSignal((signal) => signal + 1);
    }
  };

  const handleTodoCompleted = (todoId) => {
    if (focusTodoIdRef.current === String(todoId)) {
      setCompleteFocusSignal({
        todoId,
        stamp: Date.now(),
      });
    }
  };

  const handleFocusTodoCompleted = () => {
    focusTodoIdRef.current = '';
    setTodoRefreshSignal((signal) => signal + 1);
  };

  const handleFocusTimerChange = useCallback((timerStatus) => {
    setFocusTimerStatus(timerStatus);
    if (timerStatus?.todoId) {
      focusTodoIdRef.current = String(timerStatus.todoId);
    }
  }, []);

  return (
    <>
      <div className="account-bar" aria-label="当前用户">
        <span>{user.username}</span>
        <button type="button" onClick={handleLogout}>退出</button>
      </div>
      <PomodoroPage
        ref={pomodoroRef}
        focusTodoRequest={focusTodoRequest}
        unbindFocusSignal={unbindFocusSignal}
        completeFocusSignal={completeFocusSignal}
        sceneRefreshSignal={sceneRefreshSignal}
        onFocusTimerChange={handleFocusTimerChange}
        onFocusTodoCompleted={handleFocusTodoCompleted}
      />
      <aside className={`home-todo-drawer ${isTodoDrawerOpen ? 'open' : 'closed'}`} aria-label="任务清单">
        <TodoListModule
          refreshSignal={todoRefreshSignal}
          focusTimerStatus={focusTimerStatus}
          onFocusTodo={handleFocusTodo}
          onTodoDeleted={handleTodoDeleted}
          onTodoCompleted={handleTodoCompleted}
        />
      </aside>
      <HabitLauncher onHabitCreated={() => setTodoRefreshSignal((signal) => signal + 1)} />
      <SceneLauncher onScenesChanged={() => setSceneRefreshSignal((signal) => signal + 1)} />
      <button
        type="button"
        className={`home-todo-toggle ${isTodoDrawerOpen ? 'open' : 'closed'}`}
        aria-expanded={isTodoDrawerOpen}
        aria-controls="daily-todo-panel"
        onClick={() => setIsTodoDrawerOpen((isOpen) => !isOpen)}
      >
        <span className="home-todo-toggle-icon" aria-hidden="true" />
        <span>{isTodoDrawerOpen ? '收起任务' : '任务清单'}</span>
      </button>
    </>
  );
}
