async function request(path, options = {}) {
  const response = await fetch(path, {
    method: options.method ?? 'GET',
    credentials: 'same-origin',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? '请求失败');
  }

  return payload;
}

export async function getCurrentUser() {
  try {
    const payload = await request('/api/auth/me');
    return payload.user;
  } catch {
    return null;
  }
}

export async function register(credentials) {
  const payload = await request('/api/auth/register', {
    method: 'POST',
    body: credentials,
  });
  return payload.user;
}

export async function login(credentials) {
  const payload = await request('/api/auth/login', {
    method: 'POST',
    body: credentials,
  });
  return payload.user;
}

export async function logout() {
  await request('/api/auth/logout', { method: 'POST' });
}

export async function listTodos(todoDate) {
  const query = todoDate ? `?date=${encodeURIComponent(todoDate)}` : '';
  const payload = await request(`/api/todos${query}`);
  return payload.todos ?? [];
}

export async function createTodo({ title, todoDate, priority }) {
  const payload = await request('/api/todos', {
    method: 'POST',
    body: { title, todoDate, priority },
  });
  return payload.todo;
}

export async function createHabit(habit) {
  const payload = await request('/api/habits', {
    method: 'POST',
    body: habit,
  });
  return payload.habit;
}

export async function listHabits() {
  const payload = await request('/api/habits');
  return payload.habits ?? [];
}

export async function updateHabit(habitId, patch) {
  const payload = await request(`/api/habits/${habitId}`, {
    method: 'PATCH',
    body: patch,
  });
  return payload.habit;
}

export async function deleteHabit(habitId) {
  await request(`/api/habits/${habitId}`, { method: 'DELETE' });
}

export async function listScenes() {
  const payload = await request('/api/scenes');
  return payload.scenes ?? [];
}

export async function createScene(scene) {
  const payload = await request('/api/scenes', {
    method: 'POST',
    body: scene,
  });
  return payload.scene;
}

export async function updateScene(sceneId, patch) {
  const payload = await request(`/api/scenes/${sceneId}`, {
    method: 'PATCH',
    body: patch,
  });
  return payload.scene;
}

export async function deleteScene(sceneId) {
  await request(`/api/scenes/${sceneId}`, { method: 'DELETE' });
}

export async function updateTodo(todoId, patch) {
  const payload = await request(`/api/todos/${todoId}`, {
    method: 'PATCH',
    body: patch,
  });
  return payload.todo;
}

export async function deleteTodo(todoId) {
  await request(`/api/todos/${todoId}`, { method: 'DELETE' });
}

export async function recordFocusSession(session) {
  await request('/api/focus-sessions', {
    method: 'POST',
    body: session,
  });
}

export function recordFocusSessionOnUnload(session) {
  if (!navigator.sendBeacon) {
    return false;
  }
  return navigator.sendBeacon('/api/focus-sessions', JSON.stringify(session));
}

export async function getFocusSessionSummary(sessionDate) {
  const query = sessionDate ? `?date=${encodeURIComponent(sessionDate)}` : '';
  const payload = await request(`/api/focus-sessions/summary${query}`);
  return payload.summary;
}

export async function getFocusStats({ start, end, period } = {}) {
  const params = new URLSearchParams();
  if (start) {
    params.set('start', start);
  }
  if (end) {
    params.set('end', end);
  }
  if (period) {
    params.set('period', period);
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const payload = await request(`/api/focus-stats${query}`);
  return payload.stats;
}

export async function getReviewCalendar({ year, month } = {}) {
  const params = new URLSearchParams();
  if (year) {
    params.set('year', year);
  }
  if (month) {
    params.set('month', month);
  }
  const query = params.toString() ? `?${params.toString()}` : '';
  const payload = await request(`/api/review-calendar${query}`);
  return payload.calendar;
}

export async function deleteReviewTodo(todoId) {
  await request(`/api/review-todos/${todoId}`, { method: 'DELETE' });
}

export async function getPomodoroSettings() {
  const payload = await request('/api/settings/pomodoro');
  return payload.settings;
}

export async function updatePomodoroSettings(settings) {
  const payload = await request('/api/settings/pomodoro', {
    method: 'PATCH',
    body: settings,
  });
  return payload.settings;
}
