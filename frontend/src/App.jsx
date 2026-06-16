import { useEffect, useState } from 'react';
import { getCurrentUser } from './lib/api';
import AuthPage from './modules/auth/AuthPage';
import HomePage from './pages/home/HomePage';
import PomodoroPage from './modules/pomodoro/PomodoroPage';

function normalizePath(pathname) {
  if (!pathname || pathname === '/') {
    return '/';
  }

  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

function getCurrentPath() {
  return normalizePath(window.location.pathname);
}

function NotFoundPage() {
  return (
    <main className="app-home-shell app-home-shell-compact">
      <section className="app-empty-state">
        <p className="app-home-kicker">Unknown Route</p>
        <h1>这个 Todo 模块还没有准备好。</h1>
        <p className="app-home-copy">你可以先回到 Todo 首页，或者直接进入现有的番茄钟模块。</p>
        <div className="app-empty-actions">
          <a href="/">返回首页</a>
          <a href="/pomodoro">打开 /pomodoro</a>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [path, setPath] = useState(() => getCurrentPath());
  const [authState, setAuthState] = useState({
    status: 'loading',
    user: null,
  });

  useEffect(() => {
    const handlePopState = () => {
      setPath(getCurrentPath());
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let isDisposed = false;

    getCurrentUser().then((user) => {
      if (isDisposed) {
        return;
      }

      setAuthState({
        status: 'ready',
        user,
      });
    });

    return () => {
      isDisposed = true;
    };
  }, []);

  const handleAuthenticated = (user) => {
    setAuthState({
      status: 'ready',
      user,
    });
  };

  const handleLoggedOut = () => {
    setAuthState({
      status: 'ready',
      user: null,
    });
    window.history.pushState({}, '', '/');
    setPath('/');
  };

  if (authState.status === 'loading') {
    return (
      <main className="auth-shell">
        <section className="auth-panel" aria-label="加载用户状态">
          <p className="auth-kicker">Todo Workspace</p>
          <h1>正在检查登录状态</h1>
        </section>
      </main>
    );
  }

  if (!authState.user) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  if (path === '/') {
    return <HomePage user={authState.user} onLoggedOut={handleLoggedOut} />;
  }

  if (path === '/pomodoro') {
    return <PomodoroPage />;
  }

  return <NotFoundPage />;
}
