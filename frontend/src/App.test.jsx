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

beforeEach(() => {
  let habits = [];
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
    expect(screen.getAllByText('专注时间')).toHaveLength(2);
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
    expect(await within(todoPanel).findByText('0 项')).toBeInTheDocument();
  });

  it('starts focus from a daily todo timer icon', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));

    expect(screen.getAllByText('整理今天最重要的三件事')).toHaveLength(2);
    expect(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' })).toHaveTextContent('25:00');
    expect(screen.queryByText('自动切换')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂停' })).toBeInTheDocument();
  });

  it('can complete the bound focus todo from the timer task button', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));
    fireEvent.click(screen.getByRole('button', { name: '整理今天最重要的三件事' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '已完成该任务' }));

    expect(await within(todoPanel).findByText('0 项')).toBeInTheDocument();
    expect(within(todoPanel).queryByText('整理今天最重要的三件事')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未绑定任务' })).toBeDisabled();
  });

  it('closes the bound focus todo menu when clicking outside', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));
    fireEvent.click(screen.getByRole('button', { name: '整理今天最重要的三件事' }));

    expect(screen.getByRole('menuitem', { name: '取消绑定' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('main'));

    expect(screen.queryByRole('menuitem', { name: '取消绑定' })).not.toBeInTheDocument();
  });

  it('unbinds the timer when the bound todo is deleted', async () => {
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));
    expect(screen.getByRole('button', { name: '整理今天最重要的三件事' })).toBeInTheDocument();

    fireEvent.click(within(todoPanel).getByRole('button', { name: '删除任务 整理今天最重要的三件事' }));

    expect(await within(todoPanel).findByText('0 项')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未绑定任务' })).toBeDisabled();
  });

  it('records elapsed focus time when a bound todo is unbound', async () => {
    vi.useFakeTimers();
    await renderAtPath('/');

    const todoPanel = screen.getByRole('complementary', { name: '任务清单' });
    fireEvent.click(within(todoPanel).getByRole('button', { name: '开始计时 整理今天最重要的三件事' }));

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    fireEvent.click(screen.getByRole('button', { name: '整理今天最重要的三件事' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitem', { name: '取消绑定' }));
    });

    expect(within(todoPanel).getByText('已专注 0:05')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '未绑定任务' })).toBeDisabled();
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

    expect(screen.getAllByText('专注时间')).toHaveLength(2);
    expect(screen.getByText('01:00')).toBeInTheDocument();
    expect(screen.getByText('待开始')).toBeInTheDocument();
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
    expect(screen.getByText('待开始')).toBeInTheDocument();
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
