import { useState } from 'react';
import { login, register } from '../../lib/api';

export default function AuthPage({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isRegisterMode = mode === 'register';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const user = isRegisterMode
        ? await register({ username, password, inviteCode })
        : await login({ username, password });
      onAuthenticated(user);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '认证失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-panel" aria-label="用户登录">
        <p className="auth-kicker">Todo Workspace</p>
        <h1>{isRegisterMode ? '创建账号' : '登录账号'}</h1>
        <p className="auth-copy">
          {isRegisterMode ? '创建账号后，你的每日任务会保存到自己的列表。' : '登录后继续管理你的每日 Todo。'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>用户名</span>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              required
            />
          </label>

          <label className="auth-field">
            <span>密码</span>
            <input
              type="password"
              autoComplete={isRegisterMode ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          {isRegisterMode ? (
            <label className="auth-field">
              <span>邀请码</span>
              <input
                type="text"
                autoComplete="off"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value)}
                required
              />
            </label>
          ) : null}

          {errorMessage ? <p className="auth-error" role="alert">{errorMessage}</p> : null}

          <button type="submit" className="primary-button auth-submit" disabled={isSubmitting}>
            {isSubmitting ? '处理中...' : isRegisterMode ? '注册并登录' : '登录'}
          </button>
        </form>

        <button
          type="button"
          className="auth-mode-button"
          onClick={() => {
            setMode(isRegisterMode ? 'login' : 'register');
            setErrorMessage('');
          }}
        >
          {isRegisterMode ? '已有账号，去登录' : '没有账号，去注册'}
        </button>
      </section>
    </main>
  );
}
