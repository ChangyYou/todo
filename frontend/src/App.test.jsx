import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
      { todoId: 103, type: 'focus', title: '阅读 Go 后端', meta: '25m' },
      { sceneId: 201, type: 'scene', title: '运动', meta: '15m' },
    ].filter((entry) => !deletedTodoIds.has(entry.todoId)),
    tasks: [
      { todoId: 101, title: '写日报', sourceType: 'todo', completed: true, focusSeconds: 0, sessionCount: 0, completedAt: '2026-06-10 09:00:00' },
      { todoId: 102, title: '运动30分钟', sourceType: 'habit', completed: true, focusSeconds: 0, sessionCount: 0, completedAt: '2026-06-10 10:00:00' },
      { todoId: 103, title: '阅读 Go 后端', sourceType: 'todo', completed: false, focusSeconds: 1500, sessionCount: 1, completedAt: '' },
      { todoId: 0, sceneId: 201, title: '运动', sourceType: 'scene', completed: false, focusSeconds: 900, sessionCount: 1, completedAt: '' },
    ].filter((task) => !deletedTodoIds.has(task.todoId)),
  };

  return {
    year: 2026,
    month: 6,
    days,
  };
}

beforeEach(() => {
  let habits = [];
  let scenes = [{ id: 1, title: '运动', active: true }];
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
      return {
        ok: true,
        json: async () => ({ todos: todos.filter((todo) => !todo.completed) }),
      };
    }

    if (url === '/api/settings/pomodoro' && method === 'GET') {
      return {
        ok: true,
        json: async () => ({ settings: pomodoroSettings }),
      };
    }

    if (url.startsWith('/api/focus-sessions/summary') && method === 'GET') {
      const durationSeconds = todos.reduce((total, todo) => total + (todo.focusSeconds ?? 0), 0);
      return {
        ok: true,
        json: async () => ({ summary: { sessionDate: '2026-06-15', durationSeconds } }),
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
      const scene = { id: 2, title: body.title, active: true };
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
  it('renders the home page with todo and immersive pomodoro modules', async () => {
    await renderAtPath('/');

    expect(screen.getByText('Focus Tomato')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '任务清单' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '收起任务' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('region', { name: '沉浸专注' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换到卡片模式' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '切换到沉浸模式' })).not.toBeInTheDocument();
  });

  it('toggles the fixed daily todo drawer from the home page', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    const toggleButton = screen.getByRole('button', { name: '收起任务' });

    expect(todoPanel).toHaveClass('open');
    fireEvent.click(toggleButton);

    expect(todoPanel).toHaveClass('closed');
    expect(screen.getByRole('button', { name: '任务清单' })).toHaveAttribute('aria-expanded', 'false');
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
    expect(screen.queryByRole('complementary', { name: '任务清单' })).not.toBeInTheDocument();
  });

  it('lets users manage task list items beside the pomodoro module', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    expect(within(todoPanel).getByText('任务清单')).toBeInTheDocument();
    expect(await within(todoPanel).findByText('1 项')).toBeInTheDocument();
    expect(within(todoPanel).getByText('截止 2026-06-15')).toBeInTheDocument();
    expect(within(todoPanel).getByText('高')).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('button', { name: '新增任务' }));
    let taskModal = screen.getByRole('dialog', { name: '新增任务' });
    fireEvent.change(within(taskModal).getByLabelText('任务名称'), {
      target: { value: '写日报' },
    });
    fireEvent.change(within(taskModal).getByLabelText('完成日期'), {
      target: { value: '2026-06-18' },
    });
    fireEvent.click(within(taskModal).getByLabelText('低'));
    fireEvent.click(within(taskModal).getByRole('button', { name: '添加' }));

    expect(await within(todoPanel).findByText('写日报')).toBeInTheDocument();
    expect(await within(todoPanel).findByText('2 项')).toBeInTheDocument();
    expect(within(todoPanel).getByText('截止 2026-06-18')).toBeInTheDocument();
    expect(within(todoPanel).getByText('低')).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('button', { name: '编辑任务 写日报' }));
    taskModal = screen.getByRole('dialog', { name: '编辑任务' });
    fireEvent.change(within(taskModal).getByLabelText('任务名称'), {
      target: { value: '写日报和复盘' },
    });
    fireEvent.change(within(taskModal).getByLabelText('完成日期'), {
      target: { value: '2026-06-19' },
    });
    fireEvent.click(within(taskModal).getByLabelText('高'));
    fireEvent.click(within(taskModal).getByRole('button', { name: '保存' }));

    expect(await within(todoPanel).findByText('写日报和复盘')).toBeInTheDocument();
    expect(within(todoPanel).getByText('截止 2026-06-19')).toBeInTheDocument();
    expect(within(todoPanel).getAllByText('高').length).toBeGreaterThanOrEqual(1);

    fireEvent.click(within(todoPanel).getByText('写日报和复盘'));
    expect(within(todoPanel).getByText('写日报和复盘')).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByLabelText('完成任务 写日报和复盘'));
    expect(within(todoPanel).queryByText('写日报和复盘')).not.toBeInTheDocument();
    expect(await within(todoPanel).findByText('1 项')).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('button', { name: '删除任务 整理今天最重要的三件事' }));
    expect(within(todoPanel).queryByText('整理今天最重要的三件事')).not.toBeInTheDocument();
    expect(within(todoPanel).getByText('0 项')).toBeInTheDocument();
  });

  it('starts focus from a daily todo timer icon', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));

    expect(screen.getByText('把注意力留给整理今天最重要的三件事')).toBeInTheDocument();
    expect(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' })).toHaveTextContent('25:00');
    expect(screen.queryByText('自动切换')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '整理今天最重要的三件事' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
  });

  it('clears the focus copy when the bound todo is completed from the task list', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));
    fireEvent.click(within(todoPanel).getByLabelText('完成任务 整理今天最重要的三件事'));

    expect(await within(todoPanel).findByText('0 项')).toBeInTheDocument();
    expect(within(todoPanel).queryByText('整理今天最重要的三件事')).not.toBeInTheDocument();
    expect(await screen.findByText('把注意力留给眼前这一件事。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '未绑定任务' })).not.toBeInTheDocument();
  });

  it('opens and closes the scene picker from the timer controls', async () => {
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '绑定场景' }));

    expect(screen.getByRole('menuitem', { name: '不绑定场景' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('main'));

    expect(screen.queryByRole('menuitem', { name: '不绑定场景' })).not.toBeInTheDocument();
  });

  it('unbinds the timer when the bound todo is deleted', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));
    expect(screen.getByText('把注意力留给整理今天最重要的三件事')).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('button', { name: '删除任务 整理今天最重要的三件事' }));

    expect(await within(todoPanel).findByText('0 项')).toBeInTheDocument();
    expect(screen.getByText('把注意力留给眼前这一件事。')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '未绑定任务' })).not.toBeInTheDocument();
  });

  it('records elapsed focus time when a bound todo is completed', async () => {
    vi.useFakeTimers();
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    fireEvent.click(within(todoPanel).getByLabelText('完成任务 整理今天最重要的三件事'));
    await act(async () => {});

    expect(within(todoPanel).getByText('0 项')).toBeInTheDocument();
    expect(screen.getByText('今日专注 0:05')).toBeInTheDocument();
    expect(screen.getByText('把注意力留给眼前这一件事。')).toBeInTheDocument();
  });

  it('lets users create a daily habit that appears as a habit item', async () => {
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '打开习惯面板' }));

    const habitPanel = screen.getByRole('dialog', { name: '每日习惯面板' });
    fireEvent.click(within(habitPanel).getByRole('button', { name: '新建习惯' }));

    const createPanel = screen.getByRole('dialog', { name: '创建习惯' });
    expect(within(createPanel).getByLabelText('开始时间').value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(within(createPanel).getByLabelText('结束时间为永久')).toBeChecked();

    fireEvent.change(within(createPanel).getByLabelText('习惯内容'), {
      target: { value: '运动30分钟' },
    });
    fireEvent.click(within(createPanel).getByRole('button', { name: '保存' }));

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    const habitItem = await within(todoPanel).findByText('运动30分钟');
    const habitRow = habitItem.closest('.daily-todo-item');

    expect(within(habitRow).getByText('习惯')).toBeInTheDocument();
    expect(within(habitRow).queryByRole('button', { name: '删除任务 运动30分钟' })).not.toBeInTheDocument();
  });

  it('lets users edit and delete habits from the habit panel', async () => {
    vi.setSystemTime(new Date('2026-06-16T08:00:00+08:00'));
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '打开习惯面板' }));

    const habitPanel = screen.getByRole('dialog', { name: '每日习惯面板' });
    fireEvent.click(within(habitPanel).getByRole('button', { name: '新建习惯' }));
    let editorPanel = screen.getByRole('dialog', { name: '创建习惯' });
    fireEvent.change(within(editorPanel).getByLabelText('习惯内容'), {
      target: { value: '运动30分钟' },
    });
    fireEvent.click(within(editorPanel).getByRole('button', { name: '保存' }));

    expect(await within(habitPanel).findByText('运动30分钟')).toBeInTheDocument();
    expect(within(habitPanel).getByText(/永久/)).toBeInTheDocument();

    fireEvent.click(within(habitPanel).getByRole('button', { name: '编辑习惯 运动30分钟' }));
    editorPanel = screen.getByRole('dialog', { name: '编辑习惯' });
    fireEvent.change(within(editorPanel).getByLabelText('习惯内容'), {
      target: { value: '拉伸10分钟' },
    });
    fireEvent.click(within(editorPanel).getByLabelText('结束时间为永久'));
    fireEvent.change(within(editorPanel).getByLabelText('结束时间'), {
      target: { value: '2026-06-20' },
    });
    fireEvent.click(within(editorPanel).getByRole('button', { name: '保存' }));

    expect(await within(habitPanel).findByText('拉伸10分钟')).toBeInTheDocument();
    expect(within(habitPanel).getByText('2026-06-16 - 2026-06-20')).toBeInTheDocument();

    fireEvent.click(within(habitPanel).getByRole('button', { name: '删除习惯 拉伸10分钟' }));
    expect(within(habitPanel).queryByText('拉伸10分钟')).not.toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: '开始' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    fireEvent.click(screen.getByRole('button', { name: '重置' }));
    expect(screen.getByRole('button', { name: '开始' })).toBeInTheDocument();
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

  it('records a focus session for the selected todo when focus completes', async () => {
    vi.useFakeTimers();
    await renderAtPath('/');

    fireEvent.click(screen.getByRole('button', { name: '打开设置' }));
    fireEvent.change(screen.getByLabelText('专注时长（分钟）'), {
      target: { value: '1' },
    });
    fireEvent.click(screen.getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const focusCall = window.fetch.mock.calls.find(([url]) => url === '/api/focus-sessions');
    expect(focusCall).toBeTruthy();
    expect(focusCall[1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(focusCall[1].body)).toMatchObject({
      todoId: 1,
      durationSeconds: 60,
    });
    expect(JSON.parse(focusCall[1].body).sessionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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
  });

  it('opens review day detail and permanently deletes a review task', async () => {
    vi.setSystemTime(new Date('2026-06-15T08:00:00+08:00'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await renderAtPath('/pomodoro');

    fireEvent.click(screen.getByRole('button', { name: '打开个人复盘' }));
    expect(await screen.findByText('写日报')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '2026-06-10 复盘' }));
    const detail = await screen.findByRole('dialog', { name: '2026-06-10 当日复盘详情' });
    expect(within(detail).getByText('写日报')).toBeInTheDocument();
    expect(within(detail).getAllByText('已完成 · 专注 0s · 0 个番茄')).toHaveLength(2);
    expect(within(detail).getByText('未完成 · 专注 25:00 · 1 个番茄')).toBeInTheDocument();

    fireEvent.click(within(detail).getByRole('button', { name: '永久删除 写日报' }));

    expect(window.confirm).toHaveBeenCalledWith('永久删除「写日报」以及它的全部专注记录？这个操作不能撤销。');
    expect(await screen.findByRole('dialog', { name: '2026-06-10 当日复盘详情' })).toBeInTheDocument();
    expect(screen.queryByText('写日报')).not.toBeInTheDocument();
    const deleteCall = window.fetch.mock.calls.find(([url, options]) => (
      url === '/api/review-todos/101' && options?.method === 'DELETE'
    ));
    expect(deleteCall).toBeTruthy();
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
