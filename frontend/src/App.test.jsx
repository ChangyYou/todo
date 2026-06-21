import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';

async function renderAtPath(pathname) {
  window.history.pushState({}, '', pathname);
  const result = render(<App />);

  await act(async () => {});
  await act(async () => {});

  return result;
}

function createReviewCalendarMock(deletedTodoIds = new Set()) {
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = index < 1 ? 31 : index > 30 ? index - 30 : index;
    const inCurrentMonth = index >= 1 && index <= 30;
    return {
      date: inCurrentMonth ? `2026-06-${String(day).padStart(2, '0')}` : `2026-05-${String(day).padStart(2, '0')}`,
      day,
      inCurrentMonth,
      isToday: day === 15 && inCurrentMonth,
      completedTasks: 0,
      completedHabits: 0,
      sceneCount: 0,
      focusSeconds: 0,
      entries: [],
      tasks: [],
    };
  });

  days[10] = {
    date: '2026-06-10',
    day: 10,
    inCurrentMonth: true,
    isToday: false,
    completedTasks: 1,
    completedHabits: 1,
    sceneCount: 1,
    focusSeconds: 1500,
    entries: [
      { todoId: 101, type: 'task', title: '写日报', meta: '完成' },
      { todoId: 102, type: 'habit', title: '运动30分钟', meta: '打卡' },
      { todoId: 103, type: 'focus', title: '阅读 Go 后端', meta: '25m', sceneId: 201, sceneTitle: '运动', sceneColor: '#6f9fc7' },
      { sceneId: 201, type: 'scene', title: '运动', meta: '15m', sceneTitle: '运动', sceneColor: '#6f9fc7' },
    ].filter((entry) => !deletedTodoIds.has(entry.todoId)),
    tasks: [
      { todoId: 101, title: '写日报', sourceType: 'todo', completed: true, focusSeconds: 0, sessionCount: 0, completedAt: '2026-06-10 09:00:00' },
      { todoId: 102, title: '运动30分钟', sourceType: 'habit', completed: true, focusSeconds: 0, sessionCount: 0, completedAt: '2026-06-10 10:00:00' },
      { todoId: 103, sceneId: 201, sceneTitle: '运动', sceneColor: '#6f9fc7', title: '阅读 Go 后端', sourceType: 'todo', completed: false, focusSeconds: 1500, sessionCount: 1, completedAt: '' },
      { todoId: 0, sceneId: 201, sceneTitle: '运动', sceneColor: '#6f9fc7', title: '运动', sourceType: 'scene', completed: false, focusSeconds: 900, sessionCount: 1, completedAt: '' },
    ].filter((task) => !deletedTodoIds.has(task.todoId)),
  };

  days[16] = {
    date: '2026-06-16',
    day: 16,
    inCurrentMonth: true,
    isToday: false,
    completedTasks: 0,
    completedHabits: 0,
    sceneCount: 0,
    focusSeconds: 7,
    entries: [],
    tasks: [],
  };

  return {
    year: 2026,
    month: 6,
    days,
  };
}

function createReviewWeekMock() {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((label, index) => ({
    date: `2026-06-${String(14 + index).padStart(2, '0')}`,
    day: 14 + index,
    label,
    isToday: index === 1,
    events: [],
  }));

  days[1].events = [
    {
      id: 1,
      type: 'focus',
      title: '番茄专注',
      sessionDate: '2026-06-15',
      startTime: '09:00',
      endTime: '09:25',
      durationSeconds: 1500,
      meta: '25m · 1 个番茄',
      color: '#8ca39a',
    },
    {
      id: 2,
      todoId: 1,
      type: 'todo',
      title: '开会',
      startTime: '18:00',
      endTime: '18:00',
      meta: '某一时刻',
      color: '#e0a458',
    },
    {
      id: 5,
      todoId: 5,
      type: 'todo',
      title: '需求评审',
      startTime: '10:30',
      endTime: '11:00',
      meta: '30 分钟',
      color: '#7894df',
    },
    {
      id: 3,
      type: 'focus',
      sceneId: 1,
      title: '运动',
      sessionDate: '2026-06-15',
      startTime: '23:08',
      endTime: '23:08',
      durationSeconds: 7,
      meta: '7s',
      color: '#d89a5b',
    },
    {
      id: 4,
      type: 'focus',
      title: '番茄专注',
      sessionDate: '2026-06-15',
      startTime: '23:43',
      endTime: '23:44',
      durationSeconds: 60,
      meta: '1m',
      color: '#4b8768',
    },
  ];

  return {
    startDate: '2026-06-14',
    endDate: '2026-06-20',
    days,
  };
}

beforeEach(() => {
  let habits = [];
  let scenes = [{ id: 1, title: '运动', color: '#6f9fc7', active: true }];
  const deletedReviewTodoIds = new Set();
  let pomodoroSettings = {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    autoStartNextSession: true,
  };
  let todos = [
    { id: 1, title: '整理今天最重要的三件事', completed: false, todoDate: '2026-06-15', priority: 'high', sourceType: 'todo', focusSeconds: 0 },
    { id: 2, title: '完成一轮 25 分钟专注', completed: true, todoDate: '2026-06-15', priority: 'medium', sourceType: 'todo', focusSeconds: 0 },
  ];
  let focusSessionSeconds = 0;

  vi.spyOn(window, 'fetch').mockImplementation(async (input, options = {}) => {
    const url = String(input);
    const method = options.method ?? 'GET';

    if (url === '/api/auth/me') {
      return {
        ok: true,
        json: async () => ({ user: { id: 1, username: 'demo' } }),
      };
    }

    if (url.startsWith('/api/todos') && method === 'GET') {
      const requestUrl = new URL(url, 'https://todo.test');
      const status = requestUrl.searchParams.get('status') ?? 'active';
      return {
        ok: true,
        json: async () => ({
          todos: todos.filter((todo) => {
            if (status === 'all') {
              return true;
            }
            if (status === 'completed') {
              return todo.completed;
            }
            return !todo.completed;
          }),
        }),
      };
    }

    if (url === '/api/settings/pomodoro' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ settings: pomodoroSettings }),
      };
    }

    if (url.startsWith('/api/focus-sessions/summary') && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ summary: { sessionDate: '2026-06-15', durationSeconds: focusSessionSeconds } }),
      };
    }

    if (url.startsWith('/api/focus-stats') && method === 'GET') {
      return {
        ok: true,
        json: async () => ({
          stats: {
            startDate: '2026-06-09',
            endDate: '2026-06-15',
            period: 'day',
            overview: {
              todayCompletedTasks: 2,
              todayPomodoros: 1,
              todayFocusSeconds: 2100,
              totalCompletedTasks: 8,
              totalPomodoros: 3,
              totalFocusSeconds: 3900,
            },
            summary: { durationSeconds: 3900, sessionCount: 3 },
            periods: [
              { label: '9日', startDate: '2026-06-09', endDate: '2026-06-09', durationSeconds: 0, sessionCount: 0, taskTotal: 2, taskCompleted: 1, taskCompletionRate: 50 },
              { label: '10日', startDate: '2026-06-10', endDate: '2026-06-10', durationSeconds: 600, sessionCount: 1, taskTotal: 2, taskCompleted: 2, taskCompletionRate: 100 },
              { label: '11日', startDate: '2026-06-11', endDate: '2026-06-11', durationSeconds: 0, sessionCount: 0, taskTotal: 0, taskCompleted: 0, taskCompletionRate: 0 },
              { label: '12日', startDate: '2026-06-12', endDate: '2026-06-12', durationSeconds: 1200, sessionCount: 1, taskTotal: 3, taskCompleted: 1, taskCompletionRate: 33 },
              { label: '13日', startDate: '2026-06-13', endDate: '2026-06-13', durationSeconds: 0, sessionCount: 0, taskTotal: 0, taskCompleted: 0, taskCompletionRate: 0 },
              { label: '14日', startDate: '2026-06-14', endDate: '2026-06-14', durationSeconds: 0, sessionCount: 0, taskTotal: 0, taskCompleted: 0, taskCompletionRate: 0 },
              { label: '今天', startDate: '2026-06-15', endDate: '2026-06-15', durationSeconds: 2100, sessionCount: 1, taskTotal: 3, taskCompleted: 2, taskCompletionRate: 67 },
            ],
            scenePeriods: [
              { label: '9日', startDate: '2026-06-09', endDate: '2026-06-09', durationSeconds: 0, scenes: [] },
              { label: '10日', startDate: '2026-06-10', endDate: '2026-06-10', durationSeconds: 600, scenes: [{ sceneId: 0, title: '默认场景', color: '#8ca39a', durationSeconds: 600, sessionCount: 1, percentage: 100 }] },
              { label: '11日', startDate: '2026-06-11', endDate: '2026-06-11', durationSeconds: 0, scenes: [] },
              { label: '12日', startDate: '2026-06-12', endDate: '2026-06-12', durationSeconds: 1200, scenes: [{ sceneId: 2, title: '学习', color: '#6f9fc7', durationSeconds: 1200, sessionCount: 1, percentage: 100 }] },
              { label: '13日', startDate: '2026-06-13', endDate: '2026-06-13', durationSeconds: 0, scenes: [] },
              { label: '14日', startDate: '2026-06-14', endDate: '2026-06-14', durationSeconds: 0, scenes: [] },
              {
                label: '今天',
                startDate: '2026-06-15',
                endDate: '2026-06-15',
                durationSeconds: 2100,
                scenes: [
                  { sceneId: 1, title: '运动', color: '#e0a458', durationSeconds: 1500, sessionCount: 1, percentage: 71 },
                  { sceneId: 0, title: '默认场景', color: '#8ca39a', durationSeconds: 600, sessionCount: 1, percentage: 29 },
                ],
              },
            ],
            habitWeek: [
              { date: '2026-06-15', label: '一', total: 2, checked: 1, completion: 50, completedHabits: ['运动30分钟'], pendingHabits: ['阅读'] },
              { date: '2026-06-16', label: '二', total: 2, checked: 2, completion: 100, completedHabits: ['运动30分钟', '阅读'], pendingHabits: [] },
              { date: '2026-06-17', label: '三', total: 0, checked: 0, completion: 0, completedHabits: [], pendingHabits: [] },
              { date: '2026-06-18', label: '四', total: 0, checked: 0, completion: 0, completedHabits: [], pendingHabits: [] },
              { date: '2026-06-19', label: '五', total: 0, checked: 0, completion: 0, completedHabits: [], pendingHabits: [] },
              { date: '2026-06-20', label: '六', total: 0, checked: 0, completion: 0, completedHabits: [], pendingHabits: [] },
              { date: '2026-06-21', label: '日', total: 0, checked: 0, completion: 0, completedHabits: [], pendingHabits: [] },
            ],
            byTask: [
              { todoId: 1, title: '整理今天最重要的三件事', durationSeconds: 2100, sessionCount: 1 },
              { todoId: 2, title: '阅读 Go 后端', durationSeconds: 1800, sessionCount: 2 },
            ],
            recent: [
              {
                todoId: 1,
                title: '整理今天最重要的三件事',
                durationSeconds: 2100,
                sessionDate: '2026-06-15',
                createdAt: '2026-06-15 09:30:00',
              },
            ],
          },
        }),
      };
    }

    if (url.startsWith('/api/review-calendar') && method === 'GET') {
      if (url.includes('view=week')) {
        return {
          ok: true,
          json: async () => ({ week: createReviewWeekMock() }),
        };
      }

      return {
        ok: true,
        json: async () => ({ calendar: createReviewCalendarMock(deletedReviewTodoIds) }),
      };
    }

    if (url === '/api/scenes' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ scenes }),
      };
    }

    if (url === '/api/scenes' && method === 'POST') {
      const body = JSON.parse(options.body);
      const scene = { id: 2, title: body.title, color: body.color || '#4b8768', active: true };
      scenes = [scene, ...scenes];
      return {
        ok: true,
        json: async () => ({ scene }),
      };
    }

    if (url.startsWith('/api/review-todos/') && method === 'DELETE') {
      deletedReviewTodoIds.add(Number(url.replace('/api/review-todos/', '')));
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }

    if (url.startsWith('/api/focus-sessions/') && method === 'PATCH') {
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }

    if (url.startsWith('/api/focus-sessions/') && method === 'DELETE') {
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }

    if (url === '/api/settings/pomodoro' && method === 'PATCH') {
      pomodoroSettings = {
        ...pomodoroSettings,
        ...JSON.parse(options.body),
      };
      return {
        ok: true,
        json: async () => ({ settings: pomodoroSettings }),
      };
    }

    if (url === '/api/todos' && method === 'POST') {
      const body = JSON.parse(options.body);
      const todo = {
        id: 3,
        title: body.title,
        completed: false,
        todoDate: body.todoDate,
        timeType: body.timeType ?? 'date_range',
        startDate: body.startDate ?? body.todoDate,
        endDate: body.endDate ?? body.todoDate,
        startTime: body.startTime ?? '',
        endTime: body.endTime ?? '',
        priority: body.priority ?? 'medium',
        sourceType: 'todo',
        focusSeconds: 0,
      };
      todos = [todo, ...todos];
      return {
        ok: true,
        json: async () => ({ todo }),
      };
    }

    if (url === '/api/habits' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ habits }),
      };
    }

    if (url === '/api/habits' && method === 'POST') {
      const body = JSON.parse(options.body);
      const habit = {
        id: 1,
        title: body.title,
        startDate: body.startDate,
        endDate: body.endDate || undefined,
        active: true,
      };
      habits = [habit, ...habits];
      todos = [
        { id: 4, title: body.title, completed: false, todoDate: '2026-06-15', priority: 'medium', sourceType: 'habit', habitId: 1, focusSeconds: 0 },
        ...todos,
      ];
      return {
        ok: true,
        json: async () => ({ habit }),
      };
    }

    if (url === '/api/habits/1' && method === 'PATCH') {
      const body = JSON.parse(options.body);
      const habit = {
        id: 1,
        title: body.title,
        startDate: body.startDate,
        endDate: body.endDate || undefined,
        active: true,
      };
      habits = habits.map((item) => (item.id === 1 ? habit : item));
      todos = todos.map((todo) => (todo.habitId === 1 ? { ...todo, title: body.title } : todo));
      return {
        ok: true,
        json: async () => ({ habit }),
      };
    }

    if (url === '/api/habits/1' && method === 'DELETE') {
      habits = habits.filter((habit) => habit.id !== 1);
      todos = todos.filter((todo) => todo.habitId !== 1);
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }

    if (url.startsWith('/api/todos/') && method === 'PATCH') {
      const todoId = Number(url.replace('/api/todos/', ''));
      const body = JSON.parse(options.body);
      let savedTodo;
      todos = todos.map((todo) => {
        if (todo.id !== todoId) {
          return todo;
        }

        savedTodo = {
          ...todo,
          title: body.title ?? todo.title,
          completed: body.completed ?? todo.completed,
          todoDate: body.todoDate ?? todo.todoDate,
          timeType: body.timeType ?? todo.timeType,
          startDate: body.startDate ?? todo.startDate,
          endDate: body.endDate ?? todo.endDate,
          startTime: body.startTime ?? todo.startTime,
          endTime: body.endTime ?? todo.endTime,
          priority: body.priority ?? todo.priority,
        };
        return savedTodo;
      });

      return {
        ok: true,
        json: async () => ({ todo: savedTodo }),
      };
    }

    if (url.startsWith('/api/todos/') && method === 'DELETE') {
      const todoId = Number(url.replace('/api/todos/', ''));
      todos = todos.filter((todo) => todo.id !== todoId);
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }

    if (url === '/api/focus-sessions' && method === 'POST') {
      const body = JSON.parse(options.body);
      focusSessionSeconds += body.durationSeconds;
      todos = todos.map((todo) => (
        todo.id === body.todoId
          ? { ...todo, focusSeconds: (todo.focusSeconds ?? 0) + body.durationSeconds }
          : todo
      ));
      return { ok: true, json: async () => ({ status: 'ok' }) };
    }

    return {
      ok: true,
      json: async () => ({
        current: {
          temperature_2m: 24.4,
          apparent_temperature: 25.1,
          weather_code: 1,
        },
        daily: {
          temperature_2m_max: [28.2],
          temperature_2m_min: [20.3],
        },
      }),
    };
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  window.localStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('App', () => {
  it('renders the redesigned focus workspace on the home page', async () => {
    await renderAtPath('/');

    expect(screen.getByText('Focus Tomato')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: '主导航' })).toBeInTheDocument();
    expect(screen.getByText('demo').closest('.workspace-user-copy')).toBeInTheDocument();
    expect(screen.getByText('demo').closest('.workspace-user-copy')).not.toHaveTextContent('专注，让改变发生');
    expect(screen.getByRole('button', { name: '退出登录' })).toBeInTheDocument();
    expect(screen.getByText('未选择场景')).toBeInTheDocument();
    expect(screen.queryByText('工作')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: '待办事项' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '沉浸专注' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '个人复盘' })).toBeInTheDocument();
    expect(screen.getAllByText('个人复盘').length).toBeGreaterThanOrEqual(2);

    const reviewPanel = screen.getByRole('complementary', { name: '个人复盘' });
    expect(within(reviewPanel).getByText('今日专注')).toBeInTheDocument();
    expect(within(reviewPanel).getByText('场景分布')).toBeInTheDocument();
    expect(within(reviewPanel).queryByRole('tab', { name: '月视图' })).not.toBeInTheDocument();
    expect(within(reviewPanel).queryByText('月视图')).not.toBeInTheDocument();
    expect(await within(reviewPanel).findByRole('region', { name: '周日程' })).toBeInTheDocument();
    expect(within(reviewPanel).getByText('00-09')).toBeInTheDocument();
    expect(within(reviewPanel).queryByText('03:00')).not.toBeInTheDocument();
    expect(within(reviewPanel).queryByText('06:00')).not.toBeInTheDocument();
    fireEvent.click(within(reviewPanel).getAllByRole('button', { name: '查看 2026-06-15 当日复盘' })[0]);
    const weekDayDetail = await within(reviewPanel).findByRole('dialog', { name: '2026-06-15 当日复盘详情' });
    expect(within(weekDayDetail).getAllByText('番茄专注')).toHaveLength(2);
    expect(within(weekDayDetail).getByText('开会')).toBeInTheDocument();
    fireEvent.click(within(reviewPanel).getAllByRole('button', { name: '查看 2026-06-15 当日复盘' })[0]);
    expect(within(reviewPanel).queryByRole('dialog', { name: '2026-06-15 当日复盘详情' })).not.toBeInTheDocument();
    fireEvent.click(within(reviewPanel).getAllByRole('button', { name: '查看 2026-06-15 当日复盘' })[1]);
    const weekEventDayDetail = await within(reviewPanel).findByRole('dialog', { name: '2026-06-15 当日复盘详情' });
    expect(within(weekEventDayDetail).getByText('开会')).toBeInTheDocument();
    expect(within(reviewPanel).queryByRole('dialog', { name: '开会 复盘详情' })).not.toBeInTheDocument();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(weekEventDayDetail).getAllByRole('button', { name: '永久删除 番茄专注' })[0]);
    expect(window.confirm).toHaveBeenCalledWith('永久删除「番茄专注」这条专注记录？这个操作不能撤销。');
    await waitFor(() => {
      expect(within(weekEventDayDetail).getAllByText('番茄专注')).toHaveLength(1);
    });
    expect(window.fetch.mock.calls.some(([url, options]) => (
      url === '/api/focus-sessions/1' && options?.method === 'DELETE'
    ))).toBe(true);
    expect(window.fetch.mock.calls.some(([url]) => String(url).includes('/api/review-calendar') && String(url).includes('view=week'))).toBe(true);

  });

  it('switches workspace content from the sidebar navigation', async () => {
    await renderAtPath('/');

    const navigation = screen.getByRole('navigation', { name: '主导航' });
    expect(within(navigation).queryByRole('button', { name: '待办事项' })).not.toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole('button', { name: '专注统计' }));
    const statsPanel = screen.getByRole('region', { name: '专注统计' });
    expect(statsPanel).toBeInTheDocument();
    expect(within(statsPanel).getByText('概览')).toBeInTheDocument();
    expect(within(statsPanel).getByText('今日已完成')).toBeInTheDocument();
    expect(within(statsPanel).getByText('总专注时长')).toBeInTheDocument();
    expect(within(statsPanel).getByText('最近专注时长趋势')).toBeInTheDocument();
    expect(within(statsPanel).getByText('最近场景分布')).toBeInTheDocument();
    expect(within(statsPanel).getByText('最近完成率趋势')).toBeInTheDocument();
    expect(within(statsPanel).getByText('最近番茄数趋势')).toBeInTheDocument();
    expect(within(statsPanel).getByText('本周打卡进度')).toBeInTheDocument();

    fireEvent.click(within(navigation).getByRole('button', { name: '个人复盘' }));
    const reviewModule = await screen.findByRole('region', { name: '个人复盘' });
    expect(within(reviewModule).getByRole('heading', { name: '个人复盘' })).toBeInTheDocument();
    expect(within(reviewModule).queryByText('今日专注')).not.toBeInTheDocument();
    expect(within(reviewModule).queryByText('场景分布')).not.toBeInTheDocument();
    expect(await within(reviewModule).findByRole('region', { name: '月复盘' })).toBeInTheDocument();
    expect(within(reviewModule).getByRole('tab', { name: '月视图', selected: true })).toBeInTheDocument();
    expect(within(reviewModule).getByText('2026年6月')).toBeInTheDocument();
    expect(within(reviewModule).getByText('写日报')).toBeInTheDocument();
    fireEvent.click(within(reviewModule).getByRole('tab', { name: '周视图' }));
    expect(await within(reviewModule).findByRole('region', { name: '周日程' })).toBeInTheDocument();
    expect(within(reviewModule).getByText('10:00')).toBeInTheDocument();
    expect(within(reviewModule).getByText('10:30-11:00')).toBeInTheDocument();
    expect(within(reviewModule).getByText('需求评审')).toBeInTheDocument();

    expect(within(navigation).queryByRole('button', { name: '习惯养成' })).not.toBeInTheDocument();
    expect(within(navigation).queryByRole('button', { name: '场景管理' })).not.toBeInTheDocument();
    fireEvent.click(within(navigation).getByRole('button', { name: '习惯场景' }));
    const managePanel = await screen.findByRole('region', { name: '习惯场景' });
    expect(within(managePanel).getByRole('region', { name: '习惯养成' })).toBeInTheDocument();
    expect(within(managePanel).getByRole('region', { name: '场景管理' })).toBeInTheDocument();
    expect(within(managePanel).getByLabelText('新习惯名称')).toBeInTheDocument();
    expect(within(managePanel).getByText('运动')).toBeInTheDocument();

    expect(within(navigation).queryByRole('button', { name: '设置' })).not.toBeInTheDocument();
  });

  it('opens timer settings from the workspace focus toolbar', async () => {
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '计时设置' }));
    const dialog = screen.getByRole('dialog', { name: '计时设置' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText('专注时长（分钟）')).toHaveValue(25);

    fireEvent.change(within(dialog).getByLabelText('专注时长（分钟）'), {
      target: { value: '35' },
    });

    expect(screen.getByText('35:00')).toBeInTheDocument();
    const settingsCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/settings/pomodoro' &&
      options?.method === 'PATCH' &&
      JSON.parse(options.body).focusMinutes === 35
    ));
    expect(settingsCall).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '关闭计时设置' }));
    expect(screen.queryByRole('dialog', { name: '计时设置' })).not.toBeInTheDocument();
  });

  it('renders the pomodoro module page on /pomodoro', async () => {
    vi.setSystemTime(new Date('2026-05-18T08:34:00Z'));
    await renderAtPath('/pomodoro');

    const banner = screen.getByRole('banner');

    expect(within(banner).getByText('Focus Tomato')).toBeInTheDocument();
    expect(screen.getByText('Chengdu, CN')).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('今日专注 0:00')).toBeInTheDocument();
    expect(screen.getByText('专注时间')).toBeInTheDocument();
    expect(screen.getByText('16:34')).toBeInTheDocument();
    expect(screen.queryByText('北京时间')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '暂停' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开设置' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换到卡片模式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换到沉浸模式' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开音乐面板' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '沉浸专注' })).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: '待办事项' })).not.toBeInTheDocument();
  });

  it('lets users create and complete tasks from the workspace', async () => {
    vi.setSystemTime(new Date('2026-06-17T08:00:00+08:00'));
    await renderAtPath('/');

    const todoPanel = screen.getByRole('region', { name: '待办事项' });
    expect(within(todoPanel).getByRole('heading', { name: '待办事项' })).toBeInTheDocument();
    expect(await within(todoPanel).findByText('整理今天最重要的三件事')).toBeInTheDocument();
    const firstTaskRow = within(todoPanel).getByText('整理今天最重要的三件事').closest('article');
    expect(firstTaskRow.querySelectorAll('.task-color-dot')).toHaveLength(1);
    expect(firstTaskRow.querySelector('.task-title-line .task-color-dot + strong')).toHaveTextContent('整理今天最重要的三件事');
    expect(within(firstTaskRow).queryByText('学习')).not.toBeInTheDocument();
    expect(within(firstTaskRow).getByText('高优先级')).toBeInTheDocument();
    expect(within(todoPanel).getByRole('tab', { name: '全部 1' })).toHaveAttribute('aria-selected', 'true');
    expect(within(todoPanel).getByRole('tab', { name: '已完成 1' })).toBeInTheDocument();

    fireEvent.change(within(todoPanel).getByLabelText('添加任务标题'), {
      target: { value: '写日报' },
    });
    fireEvent.change(within(todoPanel).getByLabelText('任务紧急程度'), {
      target: { value: 'high' },
    });
    const startDateInput = within(todoPanel).getByLabelText('任务开始日期');
    const endDateInput = within(todoPanel).getByLabelText('任务结束日期');
    startDateInput.showPicker = vi.fn();
    endDateInput.showPicker = vi.fn();
    fireEvent.click(within(todoPanel).getByRole('button', { name: /开始日期/ }));
    fireEvent.click(within(todoPanel).getByRole('button', { name: /结束日期/ }));
    expect(startDateInput.showPicker).toHaveBeenCalledTimes(1);
    expect(endDateInput.showPicker).toHaveBeenCalledTimes(1);
    fireEvent.change(startDateInput, {
      target: { value: '2026-06-18' },
    });
    fireEvent.change(endDateInput, {
      target: { value: '2026-06-18' },
    });
    expect(within(todoPanel).getByRole('button', { name: /开始日期 6月18日/ })).toBeInTheDocument();
    expect(within(todoPanel).getByRole('button', { name: /结束日期 6月18日/ })).toBeInTheDocument();
    fireEvent.click(within(todoPanel).getByRole('button', { name: '添加任务' }));

    expect(await within(todoPanel).findByText('写日报')).toBeInTheDocument();
    const createTodoCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/todos' &&
      options?.method === 'POST' &&
      JSON.parse(options.body).title === '写日报'
    ));
    expect(JSON.parse(createTodoCall[1].body)).toMatchObject({
      priority: 'high',
      todoDate: '2026-06-18',
      startDate: '2026-06-18',
      endDate: '2026-06-18',
      timeType: 'date_range',
    });
    fireEvent.click(within(todoPanel).getByLabelText('完成任务 写日报'));
    expect(within(todoPanel).queryByText('写日报')).not.toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('tab', { name: '已完成 2' }));
    expect(await within(todoPanel).findByText('写日报')).toBeInTheDocument();
    expect(within(todoPanel).getByText('完成一轮 25 分钟专注')).toBeInTheDocument();
  });

  it('lets users delete workspace tasks', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('region', { name: '待办事项' });
    expect(await within(todoPanel).findByText('整理今天最重要的三件事')).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('button', { name: '删除任务 整理今天最重要的三件事' }));

    expect(within(todoPanel).queryByText('整理今天最重要的三件事')).not.toBeInTheDocument();
    const deleteCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/todos/1' && options?.method === 'DELETE'
    ));
    expect(deleteCall).toBeTruthy();
  });

  it('starts focus from a workspace task', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('region', { name: '待办事项' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始专注 整理今天最重要的三件事' }));

    expect(screen.getByText('把注意力留给整理今天最重要的三件事')).toBeInTheDocument();
    expect(within(todoPanel).getByText('25:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
  });

  it('clears focus copy when the focused task is completed', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('region', { name: '待办事项' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始专注 整理今天最重要的三件事' }));
    fireEvent.click(within(todoPanel).getByLabelText('完成任务 整理今天最重要的三件事'));

    expect(within(todoPanel).queryByText('整理今天最重要的三件事')).not.toBeInTheDocument();
    expect(await screen.findByText('把注意力留给眼前这一件事。')).toBeInTheDocument();
  });

  it('opens the workspace scene picker and selects a scene', async () => {
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '选择当前场景' }));

    expect(screen.getByRole('menuitem', { name: '不绑定场景' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '不绑定场景' }));
    expect(screen.getByRole('button', { name: '选择当前场景' })).toBeInTheDocument();
  });

  it('records the current workspace focus segment when pausing', async () => {
    vi.useFakeTimers();
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '选择当前场景' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '运动' }));
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    });

    const focusCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/focus-sessions' && JSON.parse(options.body).sceneId === 1
    ));
    expect(focusCall).toBeTruthy();
    expect(JSON.parse(focusCall[1].body)).toMatchObject({
      todoId: 0,
      sceneId: 1,
      durationSeconds: 10,
    });
    expect(screen.getAllByText('今日专注').length).toBeGreaterThan(0);
  });

  it('records the current workspace focus segment before logging out', async () => {
    vi.useFakeTimers();
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '选择当前场景' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '运动' }));
    fireEvent.click(screen.getByRole('button', { name: '开始专注' }));

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '退出登录' }));
    });

    const focusCallIndex = window.fetch.mock.calls.findIndex(([url]) => url === '/api/focus-sessions');
    const logoutCallIndex = window.fetch.mock.calls.findIndex(([url]) => url === '/api/auth/logout');
    expect(focusCallIndex).toBeGreaterThan(-1);
    expect(focusCallIndex).toBeLessThan(logoutCallIndex);
    expect(JSON.parse(window.fetch.mock.calls[focusCallIndex][1].body)).toMatchObject({
      todoId: 0,
      sceneId: 1,
      durationSeconds: 10,
    });
  });

  it('records elapsed focus time when a bound todo is completed', async () => {
    vi.useFakeTimers();
    await renderAtPath('/');

    const todoPanel = screen.getByRole('region', { name: '待办事项' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始专注 整理今天最重要的三件事' }));

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    fireEvent.click(within(todoPanel).getByLabelText('完成任务 整理今天最重要的三件事'));
    await act(async () => {});

    expect(within(todoPanel).queryByText('整理今天最重要的三件事')).not.toBeInTheDocument();
    expect(screen.getByText('把注意力留给眼前这一件事。')).toBeInTheDocument();
  });

  it('renders live weather details for Chengdu after loading', async () => {
    await renderAtPath('/pomodoro');

    expect(await screen.findByText('大部晴朗 24°C')).toBeInTheDocument();
    expect(screen.getByText('体感 25°C')).toBeInTheDocument();
  });

  it('shows a visible confirmation state after an icon button is clicked', async () => {
    await renderAtPath('/pomodoro');

    const startButton = screen.getByRole('button', { name: '开始' });
    fireEvent.click(startButton);

    expect(startButton).toHaveClass('is-click-confirmed');
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始' })).not.toBeInTheDocument();
  });

  it('uses one timer toggle button that switches between start and pause', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '暂停' }));
    expect(await screen.findByRole('button', { name: '开始' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(await screen.findByRole('button', { name: '开始' })).toBeInTheDocument();
  });

  it('updates the visible duration when the focus setting changes', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '30' },
    });

    expect(screen.getByText('30:00')).toBeInTheDocument();
  });

  it('persists the pomodoro duration setting for the current user', async () => {
    const firstRender = await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '40' },
    });

    expect(screen.getByText('40:00')).toBeInTheDocument();

    const settingsCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/settings/pomodoro' &&
      options?.method === 'PATCH' &&
      JSON.parse(options.body).focusMinutes === 40
    ));
    expect(settingsCall).toBeTruthy();

    firstRender.unmount();
    await renderAtPath('/pomodoro');

    expect(screen.getByText('40:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    expect(screen.getByLabelText('专注时长（分钟）')).toHaveValue(40);
  });

  it('closes the settings panel when clicking outside the timer card', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    expect(screen.getByRole('dialog', { name: '计时设置' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('main'));

    expect(screen.queryByRole('dialog', { name: '计时设置' })).not.toBeInTheDocument();
  });

  it('automatically moves into short break after focus completes', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getAllByText('短休息').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳过休息' })).toBeInTheDocument();
  });

  it('skips break and follows the auto-start setting', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByLabelText('自动开始下一阶段'));
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    fireEvent.click(screen.getByRole('button', { name: '跳过休息' }));

    expect(screen.getByText('今日专注 0:00')).toBeInTheDocument();
    expect(screen.getByText('专注时间')).toBeInTheDocument();
    expect(screen.getByText('01:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '绑定场景' })).toBeInTheDocument();
  });

  it('offers skip choices during focus and can enter break without counting completion', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByLabelText('自动开始下一阶段'));

    fireEvent.click(screen.getByRole('button', { name: '跳过' }));

    expect(screen.getByText('这次专注要怎么处理？')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '不算完成，直接休息' }));

    expect(screen.getAllByText('短休息').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('05:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '绑定场景' })).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
  });

  it('records focus time and a tomato when skipping focus as completed', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '算完成，进入休息' }));
    });

    const focusCall = window.fetch.mock.calls.find(([url]) => url === '/api/focus-sessions');
    expect(focusCall).toBeTruthy();
    expect(JSON.parse(focusCall[1].body)).toMatchObject({
      todoId: 0,
      sceneId: 0,
      durationSeconds: 6,
    });
    expect(screen.getByText('今日专注 0:06')).toBeInTheDocument();
    expect(screen.getAllByText('短休息').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
  });

  it('records focus time when ending focus without entering break', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '结束专注' }));
    });

    const focusCall = window.fetch.mock.calls.find(([url]) => url === '/api/focus-sessions');
    expect(focusCall).toBeTruthy();
    expect(JSON.parse(focusCall[1].body)).toMatchObject({
      todoId: 0,
      sceneId: 0,
      durationSeconds: 6,
    });
    expect(screen.getByText('今日专注 0:06')).toBeInTheDocument();
    expect(screen.getByText('专注时间')).toBeInTheDocument();
    expect(screen.getByText('01:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开始' })).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
  });

  it('does not record focus time at five seconds or less', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '结束专注' }));
    });

    expect(window.fetch.mock.calls.some(([url]) => url === '/api/focus-sessions')).toBe(false);
    expect(screen.getByText('今日专注 0:00')).toBeInTheDocument();
    expect(screen.getByText('01:00')).toBeInTheDocument();
  });

  it('does not record focus time when resetting the timer', async () => {
    vi.useFakeTimers();
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    fireEvent.click(screen.getByRole('button', { name: '重置' }));

    expect(window.fetch.mock.calls.some(([url]) => url === '/api/focus-sessions')).toBe(false);
    expect(screen.getByText('今日专注 0:00')).toBeInTheDocument();
    expect(screen.getByText('01:00')).toBeInTheDocument();
  });

  it('uses focus mode as the only pomodoro view', async () => {
    await renderAtPath('/pomodoro');

    expect(screen.getByText('Focus Tomato')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '沉浸专注' })).toBeInTheDocument();
    expect(screen.getByText('25:00')).toBeInTheDocument();
    expect(screen.getByText('Chengdu, CN')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换到卡片模式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换到沉浸模式' })).not.toBeInTheDocument();
  });

  it('keeps focus mode active while timer actions continue to work', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '开始' }));

    expect(screen.getByRole('region', { name: '沉浸专注' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
  });

  it('closes the skip choice dialog when clicking outside the timer card', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '跳过' }));
    expect(screen.getByRole('dialog', { name: '跳过专注选择' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('main'));

    expect(screen.queryByRole('dialog', { name: '跳过专注选择' })).not.toBeInTheDocument();
  });

  it('opens the music panel from the left bottom launcher', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开音乐面板' }));

    expect(screen.getByRole('dialog', { name: '网易云音乐' })).toBeInTheDocument();
    expect(screen.getByText('加载公开歌单，边专注边播放')).toBeInTheDocument();
  });

  it('opens the focus stats panel from the bottom launcher', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开专注统计' }));

    expect(await screen.findByRole('dialog', { name: '专注统计' })).toBeInTheDocument();
    expect(await screen.findByText('概览')).toBeInTheDocument();
    expect(screen.getByText('今日已完成')).toBeInTheDocument();
    expect(screen.getByText('今日番茄')).toBeInTheDocument();
    expect(screen.getByText('总专注时长')).toBeInTheDocument();
    expect(screen.getByText('最近专注时长趋势')).toBeInTheDocument();
    expect(screen.getByText('最近场景分布')).toBeInTheDocument();
    expect(screen.getByText('最近完成率趋势')).toBeInTheDocument();
    expect(screen.getByText('本周打卡进度')).toBeInTheDocument();
    expect(screen.getByText('最近番茄数趋势')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '今天 最近专注时长趋势详情' }));
    expect(screen.getByRole('dialog', { name: '今天 专注详情' })).toBeInTheDocument();
    expect(screen.getByText('35分钟')).toBeInTheDocument();
    expect(screen.getByText('1 个')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '今天 最近专注时长趋势详情' }));
    expect(screen.queryByRole('dialog', { name: '今天 专注详情' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '今天 最近专注时长趋势详情' }));
    expect(screen.getByRole('dialog', { name: '今天 专注详情' })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('dialog', { name: '专注统计' }));
    expect(screen.queryByRole('dialog', { name: '今天 专注详情' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '今天 场景分布详情' }));
    expect(screen.getByRole('dialog', { name: '今天 场景分布' })).toBeInTheDocument();
    expect(screen.getByText(/运动: 25分钟 · 71% · 1 个番茄/)).toBeInTheDocument();
    expect(screen.getByText(/默认场景: 10分钟 · 29% · 1 个番茄/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '今天 最近完成率趋势详情' }));
    expect(screen.getByRole('dialog', { name: '今天 完成率详情' })).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument();
    expect(screen.getByText('2/3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '今天 最近番茄数趋势详情' }));
    expect(screen.getByRole('dialog', { name: '今天 番茄详情' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-06-15 打卡详情' }));
    expect(screen.getByRole('dialog', { name: '2026-06-15 打卡详情' })).toBeInTheDocument();
    expect(screen.getByText('运动30分钟')).toBeInTheDocument();
    expect(screen.getByText('阅读')).toBeInTheDocument();
  });

  it('opens the personal review calendar from the bottom launcher', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00+08:00'));
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开个人复盘' }));

    expect(await screen.findByRole('dialog', { name: '个人复盘' })).toBeInTheDocument();
    expect(screen.getByText('2026年6月')).toBeInTheDocument();
    expect(await screen.findByText('写日报')).toBeInTheDocument();
    expect(screen.getByText('运动30分钟')).toBeInTheDocument();
    expect(screen.getByText('阅读 Go 后端')).toBeInTheDocument();
    expect(screen.getByText('专注 25m')).toBeInTheDocument();
    expect(screen.queryByText('专注 0m')).not.toBeInTheDocument();
  });

  it('switches personal review to a weekly timeline view', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00+08:00'));
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开个人复盘' }));
    expect(await screen.findByRole('dialog', { name: '个人复盘' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '周视图' }));

    expect(await screen.findAllByText('番茄专注')).toHaveLength(2);
    expect(screen.getByText('09:00-09:25')).toBeInTheDocument();
    expect(screen.getByText('10:30-11:00')).toBeInTheDocument();
    expect(screen.getByText('需求评审')).toBeInTheDocument();
    expect(screen.getByText('开会')).toBeInTheDocument();
    expect(screen.getByText('18:00-18:00')).toBeInTheDocument();
    expect(screen.getByText('00:00 - 09:00')).toBeInTheDocument();
    expect(screen.getByText('22:00 - 00:00')).toBeInTheDocument();
    expect(screen.getByText('运动')).toBeInTheDocument();
    expect(screen.getByText('23:08-23:08')).toBeInTheDocument();
    expect(screen.getByText('23:43-23:44')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '查看专注记录 番茄专注' })[0]);
    const editor = await screen.findByRole('dialog', { name: '番茄专注 专注记录详情' });
    expect(within(editor).getByText('专注记录详情')).toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText('记录名称'), { target: { value: '晨间复盘' } });
    fireEvent.change(within(editor).getByLabelText('日期'), { target: { value: '2026-06-16' } });
    fireEvent.change(within(editor).getByLabelText('开始'), { target: { value: '08:30' } });
    fireEvent.change(within(editor).getByLabelText('结束'), { target: { value: '09:10' } });
    fireEvent.change(within(editor).getByLabelText('场景'), { target: { value: '1' } });
    fireEvent.click(within(editor).getByRole('button', { name: '保存' }));

    expect(await screen.findByRole('dialog', { name: '个人复盘' })).toBeInTheDocument();
    const patchCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/focus-sessions/1' && options?.method === 'PATCH'
    ));
    expect(patchCall).toBeTruthy();
    expect(JSON.parse(patchCall[1].body)).toEqual({
      title: '晨间复盘',
      sceneId: 1,
      sessionDate: '2026-06-16',
      startTime: '08:30',
      endTime: '09:10',
    });

    fireEvent.click(screen.getAllByRole('button', { name: '查看专注记录 番茄专注' })[0]);
    const deleteEditor = await screen.findByRole('dialog', { name: '番茄专注 专注记录详情' });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    fireEvent.click(within(deleteEditor).getByRole('button', { name: '永久删除' }));

    expect(window.confirm).toHaveBeenCalledWith('永久删除「番茄专注」这条专注记录？这个操作不能撤销。');
    const deleteCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/focus-sessions/1' && options?.method === 'DELETE'
    ));
    expect(deleteCall).toBeTruthy();
  });

  it('opens review day detail and permanently deletes a review task', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00+08:00'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开个人复盘' }));
    expect(await screen.findByText('写日报')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-06-10 复盘' }));
    expect(screen.getByRole('button', { name: '2026-06-10 复盘' })).toHaveClass('selected');
    const detail = await screen.findByRole('dialog', { name: '2026-06-10 当日复盘详情' });
    expect(within(detail).getByText('写日报')).toBeInTheDocument();
    expect(within(detail).getAllByText('已完成 · 场景 默认 · 专注 0s · 0 个番茄')).toHaveLength(2);
    expect(within(detail).getByText('未完成 · 场景 运动 · 专注 25:00 · 1 个番茄')).toBeInTheDocument();
    expect(within(detail).getByText('场景 运动 · 专注 15:00 · 1 个番茄')).toBeInTheDocument();
    expect(within(detail).queryByText('未完成 · 场景 运动 · 专注 15:00 · 1 个番茄')).not.toBeInTheDocument();

    fireEvent.click(within(detail).getByRole('button', { name: '永久删除 写日报' }));

    expect(window.confirm).toHaveBeenCalledWith('永久删除「写日报」以及它的全部专注记录？这个操作不能撤销。');
    expect(await screen.findByRole('dialog', { name: '2026-06-10 当日复盘详情' })).toBeInTheDocument();
    expect(screen.queryByText('写日报')).not.toBeInTheDocument();
    const deleteCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/review-todos/101' && options?.method === 'DELETE'
    ));
    expect(deleteCall).toBeTruthy();
  });

  it('highlights the selected personal review day', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00+08:00'));
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开个人复盘' }));
    expect(await screen.findByText('写日报')).toBeInTheDocument();

    const dayButton = screen.getByRole('button', { name: '2026-06-10 复盘' });
    fireEvent.click(dayButton);

    expect(dayButton).toHaveClass('selected');
    expect(await screen.findByRole('dialog', { name: '2026-06-10 当日复盘详情' })).toBeInTheDocument();

    fireEvent.click(dayButton);

    expect(dayButton).not.toHaveClass('selected');
    expect(screen.queryByRole('dialog', { name: '2026-06-10 当日复盘详情' })).not.toBeInTheDocument();
  });

  it('closes review day detail when clicking the empty review panel area', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00+08:00'));
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开个人复盘' }));
    expect(await screen.findByText('写日报')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-06-10 复盘' }));
    expect(await screen.findByRole('dialog', { name: '2026-06-10 当日复盘详情' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('dialog', { name: '个人复盘' }));

    expect(screen.queryByRole('dialog', { name: '2026-06-10 当日复盘详情' })).not.toBeInTheDocument();
  });

  it('loads an official netease playlist iframe from a valid playlist url', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开音乐面板' }));
    fireEvent.change(screen.getByLabelText('网易云歌单链接或 ID'), {
      target: { value: 'https://music.163.com/#/playlist?id=3778678' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加载歌单' }));

    expect(screen.getByTitle('网易云歌单播放器')).toHaveAttribute(
      'src',
      'https://music.163.com/outchain/player?type=0&id=3778678&auto=0&height=430',
    );
  });

  it('shows an error when the playlist input cannot be parsed', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开音乐面板' }));
    fireEvent.change(screen.getByLabelText('网易云歌单链接或 ID'), {
      target: { value: 'https://example.com/not-supported' },
    });
    fireEvent.click(screen.getByRole('button', { name: '加载歌单' }));

    expect(screen.getByText('暂时无法识别这个网易云歌单链接或 ID。')).toBeInTheDocument();
  });

  it('restores saved playlists from localStorage', async () => {
    window.localStorage.setItem(
      'pomodoro.music.savedPlaylists',
      JSON.stringify([
        {
          id: '3778678',
          title: '深夜专注',
          sourceUrl: 'https://music.163.com/#/playlist?id=3778678',
          embedUrl: 'https://music.163.com/outchain/player?type=0&id=3778678&auto=0&height=430',
        },
      ]),
    );

    await renderAtPath('/pomodoro');
    fireEvent.click(screen.getByRole('button', { name: '打开音乐面板' }));

    expect(screen.getByRole('button', { name: '加载收藏歌单 深夜专注' })).toBeInTheDocument();
  });

  it('keeps the music panel available in focus mode', async () => {
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开音乐面板' }));

    expect(screen.getByRole('dialog', { name: '网易云音乐' })).toBeInTheDocument();
  });
});
