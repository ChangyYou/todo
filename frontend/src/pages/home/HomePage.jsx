import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowClockwise,
  CalendarBlank,
  CaretDown,
  CaretLeft,
  CaretRight,
  ChartBar,
  CheckSquare,
  CircleNotch,
  DotsThree,
  Leaf,
  ListBullets,
  Pause,
  Play,
  Plus,
  SignOut,
  SkipForward,
  Square,
  Target,
  Timer,
  Trash,
  X,
} from '@phosphor-icons/react';

import {
  createHabit,
  createScene,
  createTodo,
  deleteHabit,
  deleteFocusSession,
  deleteScene,
  deleteTodo,
  deleteReviewTodo,
  getFocusStats,
  getFocusSessionSummary,
  getPomodoroSettings,
  getReviewCalendar,
  listHabits,
  listScenes,
  listTodos,
  logout,
  recordFocusSession,
  updatePomodoroSettings,
  updateTodo,
} from '../../lib/api';
import {
  applySettingsToTimerState,
  createDefaultSettings,
  createInitialTimerState,
  formatTime,
  getNextTimerState,
  TIMER_PHASES,
} from '../../lib/pomodoro';

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今日' },
  { value: 'upcoming', label: '近期' },
  { value: 'completed', label: '已完成' },
];

const PRIORITY_STYLES = {
  high: { label: '高优先级', color: '#ee8f56' },
  medium: { label: '中优先级', color: '#8b72c7' },
  low: { label: '低优先级', color: '#6ea87c' },
};

const PRIORITY_OPTIONS = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
];

const REVIEW_COLORS = ['#7894df', '#a88bd8', '#ee945b', '#79ad83', '#9da4a0'];
const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEK_EARLY_END_MINUTES = 9 * 60;
const WEEK_LATE_START_MINUTES = 22 * 60;
const WEEK_DAY_MINUTES = 24 * 60;
const WEEK_TIMELINE_SEGMENTS = 15;
const WEEK_TIMELINE_LABELS = [
  { label: '00-09', top: 100 / (WEEK_TIMELINE_SEGMENTS * 2), compressed: true },
  ...Array.from({ length: 14 }, (_, index) => {
    const hour = index + 9;
    return { label: `${String(hour).padStart(2, '0')}:00`, minutes: hour * 60 };
  }),
  { label: '22-24', top: ((WEEK_TIMELINE_SEGMENTS - 0.5) / WEEK_TIMELINE_SEGMENTS) * 100, compressed: true },
];
const WEEK_TIMELINE_GRID_MARKS = [
  { label: '09:00', minutes: WEEK_EARLY_END_MINUTES },
  ...Array.from({ length: 12 }, (_, index) => {
    const hour = index + 10;
    return { label: `${String(hour).padStart(2, '0')}:00`, minutes: hour * 60 };
  }),
  { label: '22:00', minutes: WEEK_LATE_START_MINUTES },
];

const SETTINGS_FIELDS = [
  { key: 'focusMinutes', label: '专注时长（分钟）' },
  { key: 'shortBreakMinutes', label: '短休息（分钟）' },
  { key: 'longBreakMinutes', label: '长休息（分钟）' },
  { key: 'longBreakInterval', label: '长休息间隔（轮）' },
];

function getLocalDate(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}

function addDays(dateValue, offset) {
  const date = new Date(`${dateValue}T00:00:00`);
  date.setDate(date.getDate() + offset);
  return getLocalDate(date);
}

function getMonthFromDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function shiftMonth(value, offset) {
  const date = new Date(value.year, value.month - 1 + offset, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function formatMonthTitle(value) {
  return `${value.year}年${value.month}月`;
}

function getChineseWeekday(dateValue) {
  return new Intl.DateTimeFormat('zh-CN', { weekday: 'short' }).format(new Date(`${dateValue}T00:00:00`));
}

function formatDateHeader(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日 · ${getChineseWeekday(dateValue)}`;
}

function isTodoInDate(todo, dateValue) {
  const startDate = todo.startDate || todo.todoDate;
  const endDate = todo.endDate || todo.todoDate || startDate;
  return startDate <= dateValue && endDate >= dateValue;
}

function isUpcoming(todo, todayDate) {
  const tomorrow = addDays(todayDate, 1);
  const rangeEnd = addDays(todayDate, 7);
  const startDate = todo.startDate || todo.todoDate;
  const endDate = todo.endDate || todo.todoDate || startDate;
  return endDate >= tomorrow && startDate <= rangeEnd;
}

function formatTodoTime(todo, todayDate) {
  if (todo.timeType === 'moment' && todo.startTime) {
    const day = todo.startDate === todayDate ? '今天' : todo.startDate;
    const end = todo.endTime && todo.endTime !== todo.startTime ? ` – ${todo.endTime}` : '';
    return `${day} ${todo.startTime}${end}`;
  }

  const date = todo.startDate || todo.todoDate;
  if (date === todayDate) {
    return '今天';
  }
  if (date === addDays(todayDate, 1)) {
    return '明天';
  }
  return date;
}

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}时 ${minutes}分`;
  }
  return `${minutes}分`;
}

function formatDetailDuration(seconds = 0) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  if (minutes <= 0) {
    return `${remainingSeconds}s`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function getReviewTaskMeta(task) {
  const focusMeta = `专注 ${formatDetailDuration(task.focusSeconds || 0)} · ${task.sessionCount || 0} 个番茄`;
  if (task.sourceType === 'focus') {
    return `${task.sceneTitle ? `场景 ${task.sceneTitle} · ` : ''}${focusMeta}`;
  }
  if (task.sourceType === 'scene') {
    return `场景 ${task.sceneTitle || task.title || '默认'} · ${focusMeta}`;
  }
  return `${task.completed ? '已完成' : '未完成'} · 场景 ${task.sceneTitle || '默认'} · ${focusMeta}`;
}

function buildReviewDayFromWeekDay(day) {
  const events = day?.events ?? [];
  const focusEvents = events.filter((event) => event.type === 'focus');
  const todoEvents = events.filter((event) => event.type === 'todo');
  const habitEvents = events.filter((event) => event.type === 'habit');
  const sceneIds = new Set(focusEvents.map((event) => event.sceneId).filter(Boolean));

  return {
    date: day.date,
    day: day.day,
    inCurrentMonth: true,
    isToday: day.isToday,
    completedTasks: todoEvents.length,
    completedHabits: habitEvents.length,
    sceneCount: sceneIds.size,
    focusSeconds: focusEvents.reduce((total, event) => total + (event.durationSeconds || 0), 0),
    entries: events.map((event) => ({
      id: event.id,
      todoId: event.todoId,
      sceneId: event.sceneId,
      type: event.type === 'todo' ? 'task' : event.type,
      title: event.title,
      meta: event.meta || formatWeekEventTime(event),
      sceneTitle: event.sceneTitle,
      sceneColor: event.color,
    })),
    tasks: events.map((event) => ({
      sessionId: event.type === 'focus' ? event.id : 0,
      todoId: event.todoId || 0,
      sceneId: event.sceneId || 0,
      title: event.title,
      sourceType: event.type === 'focus' ? 'focus' : event.type === 'habit' ? 'habit' : 'todo',
      completed: event.type !== 'focus',
      focusSeconds: event.durationSeconds || 0,
      sessionCount: event.type === 'focus' ? 1 : 0,
      completedAt: event.type === 'focus' ? '' : `${day.date} ${event.startTime || ''}`.trim(),
      sceneTitle: event.sceneTitle || '',
      sceneColor: event.color,
    })),
  };
}

function formatCompactDuration(seconds = 0) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h${minutes}m`;
}

function formatPercent(value = 0) {
  return `${Math.round(value)}%`;
}

function getSceneColor(scene, index = 0) {
  return scene?.color || REVIEW_COLORS[index % REVIEW_COLORS.length] || '#8ca39a';
}

function getPhaseLabel(phase) {
  if (phase === TIMER_PHASES.SHORT_BREAK) {
    return '短休息';
  }
  if (phase === TIMER_PHASES.LONG_BREAK) {
    return '长休息';
  }
  return '专注时间';
}

function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  return now;
}

function Sidebar({ user, activeSection, onSectionChange, onLogout }) {
  const navItems = [
    { id: 'plan', label: '今日计划', icon: CalendarBlank },
    { id: 'stats', label: '专注统计', icon: ChartBar },
    { id: 'review', label: '个人复盘', icon: ListBullets },
    { id: 'manage', label: '习惯场景', icon: Target },
  ];

  return (
    <aside className="workspace-sidebar" aria-label="应用导航">
      <div className="brand-lockup">
        <span className="brand-mark"><img src="/favicon.svg" alt="" /></span>
        <span>Focus Tomato</span>
      </div>

      <nav className="workspace-nav" aria-label="主导航">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={activeSection === item.id ? 'active' : ''}
              onClick={() => onSectionChange(item.id)}
            >
              <Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="workspace-user-card">
        <div className="user-avatar" aria-hidden="true">
          <Leaf weight="fill" />
        </div>
        <div className="workspace-user-copy">
          <strong>{user.username}</strong>
        </div>
        <button type="button" aria-label="退出登录" onClick={onLogout}>
          <SignOut />
        </button>
      </div>
    </aside>
  );
}

function TaskPanel({
  todos,
  status,
  errorMessage,
  activeFilter,
  todayDate,
  focusTimerStatus,
  onFilterChange,
  onCreateTodo,
  onToggleTodo,
  onDeleteTodo,
  onFocusTodo,
}) {
  const [draftTitle, setDraftTitle] = useState('');
  const [draftPriority, setDraftPriority] = useState('medium');
  const [draftStartDate, setDraftStartDate] = useState(todayDate);
  const [draftEndDate, setDraftEndDate] = useState(todayDate);
  const startDateInputRef = useRef(null);
  const endDateInputRef = useRef(null);
  const visibleTodos = useMemo(() => todos.filter((todo) => {
    if (activeFilter === 'completed') {
      return todo.completed;
    }
    if (todo.completed) {
      return false;
    }
    if (activeFilter === 'today') {
      return isTodoInDate(todo, todayDate);
    }
    if (activeFilter === 'upcoming') {
      return isUpcoming(todo, todayDate);
    }
    return true;
  }), [activeFilter, todos, todayDate]);

  const groupedTodos = useMemo(() => {
    const tomorrow = addDays(todayDate, 1);
    return {
      today: visibleTodos.filter((todo) => isTodoInDate(todo, todayDate)),
      tomorrow: visibleTodos.filter((todo) => !isTodoInDate(todo, todayDate) && isTodoInDate(todo, tomorrow)),
      later: visibleTodos.filter((todo) => !isTodoInDate(todo, todayDate) && !isTodoInDate(todo, tomorrow)),
    };
  }, [todayDate, visibleTodos]);

  const filterCounts = useMemo(() => ({
    all: todos.filter((todo) => !todo.completed).length,
    today: todos.filter((todo) => !todo.completed && isTodoInDate(todo, todayDate)).length,
    upcoming: todos.filter((todo) => !todo.completed && isUpcoming(todo, todayDate)).length,
    completed: todos.filter((todo) => todo.completed).length,
  }), [todos, todayDate]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const title = draftTitle.trim();
    if (!title) {
      return;
    }
    onCreateTodo({
      title,
      priority: draftPriority,
      startDate: draftStartDate,
      endDate: draftEndDate,
    });
    setDraftTitle('');
    setDraftPriority('medium');
    setDraftStartDate(todayDate);
    setDraftEndDate(todayDate);
  };

  const openDatePicker = (input) => {
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
        return;
      }
    } catch {
      // Fall back below when a browser refuses showPicker for the current input state.
    }
    input.focus();
    input.click();
  };

  const currentPriority = PRIORITY_STYLES[draftPriority] ?? PRIORITY_STYLES.medium;

  return (
    <section className="task-board panel-frame" aria-label="待办事项">
      <header className="panel-header">
        <h1>待办事项</h1>
        <div className="panel-actions">
          <button type="button" aria-label="列表视图"><ListBullets /></button>
          <button type="button" aria-label="更多任务操作"><DotsThree weight="bold" /></button>
        </div>
      </header>

      <form className="task-inline-add" onSubmit={handleSubmit}>
        <button type="submit" className="task-add-submit" aria-label="添加任务">
          <Plus />
        </button>
        <input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          placeholder="添加任务"
          aria-label="添加任务标题"
        />
        <div className="task-inline-fields">
          <div className={`task-priority-select priority-${draftPriority}`}>
            <span>紧急程度</span>
            <strong>{currentPriority.label.replace('优先级', '')}</strong>
            <select
              aria-label="任务紧急程度"
              value={draftPriority}
              onChange={(event) => setDraftPriority(event.target.value)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="task-date-select">
            <button type="button" onClick={() => openDatePicker(startDateInputRef.current)}>
              <span>开始日期</span>
              <strong>{formatShortDate(draftStartDate)}</strong>
            </button>
            <input
              ref={startDateInputRef}
              type="date"
              aria-label="任务开始日期"
              value={draftStartDate}
              onChange={(event) => {
                setDraftStartDate(event.target.value);
                if (draftEndDate < event.target.value) {
                  setDraftEndDate(event.target.value);
                }
              }}
            />
          </div>
          <div className="task-date-select">
            <button type="button" onClick={() => openDatePicker(endDateInputRef.current)}>
              <span>结束日期</span>
              <strong>{formatShortDate(draftEndDate)}</strong>
            </button>
            <input
              ref={endDateInputRef}
              type="date"
              aria-label="任务结束日期"
              value={draftEndDate}
              min={draftStartDate}
              onChange={(event) => setDraftEndDate(event.target.value)}
            />
          </div>
        </div>
      </form>

      <div className="segmented-tabs" role="tablist" aria-label="任务筛选">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            role="tab"
            aria-selected={activeFilter === filter.value}
            className={activeFilter === filter.value ? 'active' : ''}
            onClick={() => onFilterChange(filter.value)}
          >
            {filter.label} {filterCounts[filter.value] || ''}
          </button>
        ))}
      </div>

      <div className="task-section-title">
        <strong>今天</strong>
        <span>{formatDateHeader(todayDate)}</span>
      </div>

      {status === 'loading' ? <p className="workspace-state">任务加载中...</p> : null}
      {errorMessage ? <p className="workspace-error" role="alert">{errorMessage}</p> : null}

      <TaskGroup
        todos={groupedTodos.today}
        focusTimerStatus={focusTimerStatus}
        todayDate={todayDate}
        onToggleTodo={onToggleTodo}
        onDeleteTodo={onDeleteTodo}
        onFocusTodo={onFocusTodo}
      />

      {activeFilter !== 'today' && groupedTodos.tomorrow.length > 0 ? (
        <>
          <div className="task-section-title task-section-title-lower">
            <strong>明天</strong>
            <span>{formatDateHeader(addDays(todayDate, 1))}</span>
          </div>
          <TaskGroup
            todos={groupedTodos.tomorrow}
            focusTimerStatus={focusTimerStatus}
            todayDate={todayDate}
            onToggleTodo={onToggleTodo}
            onDeleteTodo={onDeleteTodo}
            onFocusTodo={onFocusTodo}
          />
        </>
      ) : null}

      {activeFilter !== 'today' && groupedTodos.later.length > 0 ? (
        <>
          <div className="task-section-title task-section-title-lower">
            <strong>近期</strong>
            <span>未来 7 天</span>
          </div>
          <TaskGroup
            todos={groupedTodos.later}
            focusTimerStatus={focusTimerStatus}
            todayDate={todayDate}
            onToggleTodo={onToggleTodo}
            onDeleteTodo={onDeleteTodo}
            onFocusTodo={onFocusTodo}
          />
        </>
      ) : null}

      {status === 'ready' && visibleTodos.length === 0 ? (
        <p className="workspace-empty">{activeFilter === 'completed' ? '还没有已完成任务。' : '今天很清爽，先添加一件事。'}</p>
      ) : null}
    </section>
  );
}

function TaskGroup({ todos, focusTimerStatus, todayDate, onToggleTodo, onDeleteTodo, onFocusTodo }) {
  return (
    <div className="task-list">
      {todos.map((todo) => {
        const priority = PRIORITY_STYLES[todo.priority] ?? PRIORITY_STYLES.medium;
        const isFocusTodo = String(focusTimerStatus?.todoId ?? '') === String(todo.id);
        return (
          <article key={todo.id} className={`task-row ${todo.completed ? 'completed' : ''}`}>
            <button
              type="button"
              className="task-checkbox"
              aria-label={todo.completed ? `恢复任务 ${todo.title}` : `完成任务 ${todo.title}`}
              onClick={() => onToggleTodo(todo)}
            >
              {todo.completed ? <CheckSquare weight="fill" /> : <Square />}
            </button>
            <button type="button" className="task-content" aria-label={`开始专注 ${todo.title}`} onClick={() => onFocusTodo(todo)}>
              <span className="task-title-line">
                <span className="task-color-dot" style={{ '--task-color': priority.color }} />
                <strong>{todo.title}</strong>
              </span>
            </button>
            <div className="task-meta-line" aria-label="任务信息">
              <span>{todo.sourceType === 'habit' ? '习惯' : priority.label}</span>
              <span>{formatTodoTime(todo, todayDate)}</span>
            </div>
            <button
              type="button"
              className="task-delete-button"
              aria-label={`删除任务 ${todo.title}`}
              onClick={() => onDeleteTodo(todo)}
            >
              <Trash />
            </button>
            {isFocusTodo ? <span className="task-running-time">{formatTime(focusTimerStatus.remainingSeconds)}</span> : null}
          </article>
        );
      })}
    </div>
  );
}

function FocusPanel({
  settings,
  timerState,
  focusCopy,
  selectedScene,
  scenes,
  todayFocusSeconds,
  onTimerAction,
  onSceneChange,
  onOpenSettings,
}) {
  const [isSceneMenuOpen, setIsSceneMenuOpen] = useState(false);
  const currentRound = (timerState.completedFocusSessions % settings.longBreakInterval) + 1;
  const nextPhaseLabel = currentRound === settings.longBreakInterval ? '长休息' : '短休息';

  return (
    <main className="focus-stage" aria-label="专注工作台">
      <header className="focus-topline">
        <span><CircleNotch /> 专注，让改变发生。</span>
        <button type="button" className="soft-pill" aria-label="计时设置" onClick={onOpenSettings}>
          <Timer /> 计时设置
        </button>
      </header>

      <div className="scene-selector">
        <span>当前场景</span>
        <button type="button" aria-label="选择当前场景" onClick={() => setIsSceneMenuOpen((value) => !value)}>
          {selectedScene ? <span className="scene-swatch" style={{ '--scene-color': selectedScene.color || '#7894df' }} /> : null}
          <span className={selectedScene ? '' : 'scene-empty-label'}>{selectedScene?.title || '未选择场景'}</span>
          <CaretDown />
        </button>
        {isSceneMenuOpen ? (
          <div className="scene-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => { onSceneChange(null); setIsSceneMenuOpen(false); }}>
              不绑定场景
            </button>
            {scenes.map((scene) => (
              <button key={scene.id} type="button" role="menuitem" onClick={() => { onSceneChange(scene); setIsSceneMenuOpen(false); }}>
                <span className="scene-swatch" style={{ '--scene-color': scene.color || '#7894df' }} />
                {scene.title}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <section className="timer-hero" role="region" aria-label="沉浸专注">
        <p><Leaf weight="fill" /> {getPhaseLabel(timerState.phase)}</p>
        <div className="timer-display">{formatTime(timerState.remainingSeconds)}</div>
        <span className="focus-copy">{focusCopy}</span>
        <div className="focus-metrics">
          <span>今日专注</span>
          <span>{formatDuration(todayFocusSeconds)}</span>
        </div>
        <div className="workspace-timer-controls controls" role="group" aria-label="计时控制">
          <button
            type="button"
            className="primary-button timer-action-button has-tooltip"
            aria-label={timerState.isRunning ? '暂停' : '开始专注'}
            data-tooltip={timerState.isRunning ? '暂停' : '开始'}
            onClick={() => onTimerAction(timerState.isRunning ? 'pause' : 'start')}
          >
            {timerState.isRunning ? <Pause weight="fill" /> : <Play weight="fill" />}
          </button>
          <button
            type="button"
            className="ghost-button timer-action-button has-tooltip"
            aria-label="重置"
            data-tooltip="重置"
            onClick={() => onTimerAction('reset')}
          >
            <ArrowClockwise />
          </button>
          {timerState.phase === TIMER_PHASES.FOCUS ? (
            <button
              type="button"
              className="ghost-button timer-action-button has-tooltip"
              aria-label="结束专注"
              data-tooltip="结束专注"
              onClick={() => onTimerAction('endFocus')}
            >
              <Square weight="fill" />
            </button>
          ) : null}
          <button
            type="button"
            className="ghost-button timer-action-button has-tooltip"
            aria-label={timerState.phase === TIMER_PHASES.FOCUS ? '跳过' : '跳过休息'}
            data-tooltip={timerState.phase === TIMER_PHASES.FOCUS ? '跳过' : '跳过休息'}
            onClick={() => onTimerAction(timerState.phase === TIMER_PHASES.FOCUS ? 'skipFocusCompleted' : 'skipBreak')}
          >
            <SkipForward weight="fill" />
          </button>
        </div>

        <footer className="cycle-footer">
          <div>
            <span>CYCLE</span>
            <strong>{currentRound} / {settings.longBreakInterval}</strong>
          </div>
          <div className="cycle-divider" />
          <div>
            <span>NEXT</span>
            <strong>{nextPhaseLabel}</strong>
            <small>{settings.shortBreakMinutes} 分钟</small>
          </div>
        </footer>
      </section>
    </main>
  );
}

function ReviewPanel({ stats, todayDate, refreshSignal = 0, variant = 'aside' }) {
  const isModuleView = variant === 'module';
  const [viewMode, setViewMode] = useState(() => (isModuleView ? 'month' : 'week'));
  const [viewMonth, setViewMonth] = useState(() => getMonthFromDate(todayDate));
  const [viewDate, setViewDate] = useState(todayDate);
  const [calendar, setCalendar] = useState(null);
  const [week, setWeek] = useState(null);
  const [selectedReviewDay, setSelectedReviewDay] = useState(null);
  const [reviewDetailError, setReviewDetailError] = useState('');
  const [reviewDeleteStatus, setReviewDeleteStatus] = useState('idle');
  const [reviewStatus, setReviewStatus] = useState('idle');
  const [reviewError, setReviewError] = useState('');
  const [reviewReloadSignal, setReviewReloadSignal] = useState(0);
  const todayStats = stats?.overview ?? {};
  const sceneItems = stats?.scenePeriods?.find((period) => period.startDate === todayDate)?.scenes
    ?? stats?.scenePeriods?.at(-1)?.scenes
    ?? [];
  const normalizedScenes = sceneItems.length > 0
    ? sceneItems
    : [{ title: '默认', durationSeconds: 0, percentage: 0, color: '#9da4a0', sessionCount: 0 }];
  const donut = normalizedScenes.reduce((segments, item, index) => {
    const previous = segments.total;
    const next = previous + Math.max(0, item.percentage || 0);
    return {
      total: next,
      value: `${segments.value}, ${item.color || REVIEW_COLORS[index % REVIEW_COLORS.length]} ${previous}% ${next}%`,
    };
  }, { total: 0, value: '' }).value.replace(/^, /, '');

  useEffect(() => {
    let disposed = false;
    setSelectedReviewDay(null);
    setReviewDetailError('');
    setReviewStatus('loading');
    setReviewError('');
    const request = viewMode === 'month'
      ? getReviewCalendar(viewMonth)
      : getReviewCalendar({ view: 'week', date: viewDate });

    request
      .then((nextReview) => {
        if (disposed) return;
        if (viewMode === 'month') {
          setCalendar(nextReview);
          setWeek(null);
        } else {
          setWeek(nextReview);
          setCalendar(null);
        }
        setReviewStatus('ready');
      })
      .catch((error) => {
        if (disposed) return;
        setReviewStatus('error');
        setReviewError(error instanceof Error ? error.message : '个人复盘暂时不可用');
      });

    return () => {
      disposed = true;
    };
  }, [viewMode, viewDate, viewMonth, refreshSignal, reviewReloadSignal]);

  const handleSelectReviewDay = (day) => {
    if (!day?.date) return;
    if (selectedReviewDay?.date === day.date) {
      setSelectedReviewDay(null);
      setReviewDetailError('');
      return;
    }
    setReviewDetailError('');
    setSelectedReviewDay(day.tasks ? day : buildReviewDayFromWeekDay(day));
  };

  const refreshReview = () => setReviewReloadSignal((signal) => signal + 1);

  const handleGoToToday = () => {
    setViewDate(todayDate);
    setViewMonth(getMonthFromDate(todayDate));
    setSelectedReviewDay(null);
    setReviewDetailError('');
  };

  const handleDeleteReviewTask = async (task) => {
    if (!task) return;
    const isFocusRecord = task.sourceType === 'focus';
    if (isFocusRecord && !task.sessionId) return;
    if (!isFocusRecord && (!task.todoId || task.sourceType === 'scene')) return;
    const message = isFocusRecord
      ? `永久删除「${task.title}」这条专注记录？这个操作不能撤销。`
      : `永久删除「${task.title}」以及它的全部专注记录？这个操作不能撤销。`;
    if (!window.confirm(message)) {
      return;
    }
    setReviewDeleteStatus('deleting');
    setReviewDetailError('');
    try {
      if (isFocusRecord) {
        await deleteFocusSession(task.sessionId);
      } else {
        await deleteReviewTodo(task.todoId);
      }
      setSelectedReviewDay((day) => day ? {
        ...day,
        tasks: day.tasks.filter((item) => (
          isFocusRecord ? item.sessionId !== task.sessionId : item.todoId !== task.todoId
        )),
        entries: day.entries.filter((item) => (
          isFocusRecord ? item.id !== task.sessionId : item.todoId !== task.todoId
        )),
      } : day);
      refreshReview();
    } catch (error) {
      setReviewDetailError(error instanceof Error ? error.message : isFocusRecord ? '专注记录删除失败' : '复盘任务删除失败');
    } finally {
      setReviewDeleteStatus('idle');
    }
  };

  const PanelElement = variant === 'module' ? 'section' : 'aside';

  return (
    <PanelElement className={`review-panel panel-frame ${variant === 'module' ? 'review-panel-module' : ''}`} aria-label="个人复盘">
      <header className="panel-header review-workspace-header">
        <div>
          <h2>个人复盘</h2>
          {isModuleView ? (
            <div className="review-view-tabs" role="tablist" aria-label="复盘视图">
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'month'}
                className={viewMode === 'month' ? 'active' : ''}
                onClick={() => setViewMode('month')}
              >
                月视图
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'week'}
                className={viewMode === 'week' ? 'active' : ''}
                onClick={() => setViewMode('week')}
              >
                周视图
              </button>
            </div>
          ) : null}
        </div>
        {isModuleView ? (
          <div className="review-month-controls">
            <button
              type="button"
              className="review-icon-button has-tooltip"
              aria-label={viewMode === 'month' ? '上个月' : '上一周'}
              data-tooltip={viewMode === 'month' ? '上个月' : '上一周'}
              onClick={() => (viewMode === 'month'
                ? setViewMonth((month) => shiftMonth(month, -1))
                : setViewDate((date) => addDays(date, -7)))}
            >
              <CaretLeft />
            </button>
            <strong>{viewMode === 'month' ? formatMonthTitle(viewMonth) : week?.startDate ? `${formatShortDate(week.startDate)} - ${formatShortDate(week.endDate)}` : '本周'}</strong>
            <button
              type="button"
              className="review-icon-button has-tooltip"
              aria-label={viewMode === 'month' ? '下个月' : '下一周'}
              data-tooltip={viewMode === 'month' ? '下个月' : '下一周'}
              onClick={() => (viewMode === 'month'
                ? setViewMonth((month) => shiftMonth(month, 1))
                : setViewDate((date) => addDays(date, 7)))}
            >
              <CaretRight />
            </button>
            <button type="button" className="review-today-button" onClick={handleGoToToday}>
              今天
            </button>
          </div>
        ) : (
          <button type="button" aria-label="打开日历"><CalendarBlank /></button>
        )}
      </header>

      {reviewStatus === 'loading' ? <p className="review-inline-state">复盘加载中...</p> : null}
      {reviewError ? <p className="review-inline-error" role="alert">{reviewError}</p> : null}

      {viewMode === 'month' && isModuleView ? (
        <ReviewMonthCalendar
          calendar={calendar}
          todayDate={todayDate}
          selectedDay={selectedReviewDay}
          onSelectDay={handleSelectReviewDay}
        />
      ) : (
        <ReviewWeekCard
          week={week}
          todayDate={todayDate}
          selectedDay={selectedReviewDay}
          onSelectDay={handleSelectReviewDay}
          onPreviousWeek={() => setViewDate((date) => addDays(date, -7))}
          onNextWeek={() => setViewDate((date) => addDays(date, 7))}
          showHeader={!isModuleView}
        />
      )}

      {selectedReviewDay ? (
        <section className="review-detail-panel workspace-review-detail" role="dialog" aria-label={`${selectedReviewDay.date} 当日复盘详情`}>
          <div className="review-detail-header">
            <div>
              <p className="review-kicker">Day Detail</p>
              <h3>{selectedReviewDay.date} 复盘详情</h3>
            </div>
            <button type="button" className="review-today-button" onClick={() => setSelectedReviewDay(null)}>
              关闭
            </button>
          </div>
          <div className="review-detail-summary">
            <span>任务 {selectedReviewDay.completedTasks || 0}</span>
            <span>习惯 {selectedReviewDay.completedHabits || 0}</span>
            <span>场景 {selectedReviewDay.sceneCount || 0}</span>
            <span>专注 {formatDuration(selectedReviewDay.focusSeconds || 0)}</span>
          </div>
          {reviewDetailError ? <p className="review-inline-error" role="alert">{reviewDetailError}</p> : null}
          <div className="review-task-list">
            {(selectedReviewDay.tasks ?? []).length > 0 ? selectedReviewDay.tasks.map((task, index) => (
              <article
                key={`${task.sourceType}-${task.sessionId || task.todoId || task.sceneId || index}`}
                className={`review-task-row ${task.sceneColor ? 'with-scene-color' : ''}`}
                style={task.sceneColor ? { '--review-scene-color': task.sceneColor } : undefined}
              >
                <div className="review-task-main">
                  <span className={`review-task-badge ${task.sourceType}`}>
                    {task.sourceType === 'habit' ? '习惯' : task.sourceType === 'scene' ? '场景' : task.sourceType === 'focus' ? '专注' : '任务'}
                  </span>
                  <strong>{task.title}</strong>
                  <small>{getReviewTaskMeta(task)}</small>
                </div>
                {((task.sourceType === 'focus' && task.sessionId) || (task.sourceType !== 'scene' && task.todoId)) ? (
                  <button
                    type="button"
                    className="review-delete-button"
                    aria-label={`永久删除 ${task.title}`}
                    disabled={reviewDeleteStatus === 'deleting'}
                    onClick={() => handleDeleteReviewTask(task)}
                  >
                    <Trash />
                  </button>
                ) : null}
              </article>
            )) : (
              <p className="review-empty">这一天还没有可复盘的任务。</p>
            )}
          </div>
        </section>
      ) : null}

      <section className="review-card today-focus-card">
        <div className="review-card-title">
          <strong>今日专注</strong>
          <button type="button">详情</button>
        </div>
        <div className="today-focus-metrics">
          <div>
            <span className="metric-icon green"><Timer weight="fill" /></span>
            <small>专注时长</small>
            <strong>{formatDuration(todayStats.todayFocusSeconds || 0)}</strong>
          </div>
          <div>
            <span className="metric-icon tomato"><img src="/favicon.svg" alt="" /></span>
            <small>番茄数量</small>
            <strong>{todayStats.todayPomodoros || 0}</strong>
          </div>
        </div>
      </section>

      <section className="review-card scene-breakdown">
        <div className="review-card-title">
          <strong>场景分布</strong>
          <button type="button">更多统计</button>
        </div>
        <div className="scene-chart-row">
          <div className="donut-chart" style={{ '--donut': donut || '#9da4a0 0% 100%' }} />
          <div className="scene-legend">
            {normalizedScenes.slice(0, 5).map((scene, index) => (
              <div key={`${scene.sceneId || scene.title}-${index}`}>
                <span className="legend-dot" style={{ '--legend-color': scene.color || REVIEW_COLORS[index % REVIEW_COLORS.length] }} />
                <span>{scene.title}</span>
                <span>{scene.percentage || 0}%</span>
                <span>{formatDuration(scene.durationSeconds || 0)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <p className="autosave-note">数据已自动保存</p>
    </PanelElement>
  );
}

function WorkspaceModulePanel({
  activeSection,
  stats,
  habits,
  habitStatus,
  habitDraft,
  sceneDraft,
  scenes,
  onHabitDraftChange,
  onSceneDraftChange,
  onCreateHabit,
  onDeleteHabit,
  onCreateScene,
  onDeleteScene,
}) {
  if (activeSection === 'stats') {
    const overview = stats?.overview ?? {};
    const periods = stats?.periods ?? [];
    const scenePeriods = stats?.scenePeriods ?? [];
    const habitWeek = stats?.habitWeek ?? [];
    const maxFocusSeconds = Math.max(300, ...periods.map((item) => item.durationSeconds ?? 0));
    const maxPomodoros = Math.max(5, ...periods.map((item) => item.sessionCount ?? 0));
    return (
      <section className="workspace-module-panel panel-frame" aria-label="专注统计">
        <header className="panel-header">
          <h2>专注统计</h2>
          <span className="module-eyebrow">Focus Stats</span>
        </header>
        <div className="workspace-stats-content">
          <section className="focus-stats-overview workspace-focus-stats-overview" aria-label="概览">
            <h3>概览</h3>
            <div className="focus-stats-overview-grid">
              <StatsOverviewCard label="今日已完成" value={overview.todayCompletedTasks ?? 0} />
              <StatsOverviewCard label="今日番茄" value={overview.todayPomodoros ?? 0} />
              <StatsOverviewCard label="今日专注时长" value={formatCompactDuration(overview.todayFocusSeconds ?? 0)} />
              <StatsOverviewCard label="总已完成" value={overview.totalCompletedTasks ?? 0} />
              <StatsOverviewCard label="总番茄" value={overview.totalPomodoros ?? 0} />
              <StatsOverviewCard label="总专注时长" value={formatCompactDuration(overview.totalFocusSeconds ?? 0)} />
            </div>
          </section>

          <WorkspaceTrendCard
            title="最近专注时长趋势"
            items={periods}
            valueKey="durationSeconds"
            maxValue={maxFocusSeconds}
            formatValue={(value) => `${Math.round(value / 60)}m`}
          />

          <WorkspaceSceneDistributionCard items={scenePeriods} />

          <WorkspaceTrendCard
            title="最近完成率趋势"
            items={periods}
            valueKey="taskCompletionRate"
            maxValue={100}
            formatValue={formatPercent}
            percent
          />

          <WorkspaceTrendCard
            title="最近番茄数趋势"
            items={periods}
            valueKey="sessionCount"
            maxValue={maxPomodoros}
            formatValue={(value) => String(value)}
          />

          <WorkspaceHabitWeekCard days={habitWeek} />
        </div>
      </section>
    );
  }

  if (activeSection === 'manage') {
    return (
      <section className="workspace-module-panel panel-frame" aria-label="习惯场景">
        <header className="panel-header">
          <h2>习惯场景</h2>
          <span className="module-eyebrow">Habits & Scenes</span>
        </header>
        <div className="workspace-manage-grid">
          <section className="module-card" aria-label="习惯养成">
            <div className="module-card-header">
              <h3>习惯养成</h3>
              <span className="module-eyebrow">Habits</span>
            </div>
            <form className="module-inline-form" onSubmit={onCreateHabit}>
              <input aria-label="新习惯名称" value={habitDraft} onChange={(event) => onHabitDraftChange(event.target.value)} placeholder="例如 每天阅读 20 分钟" />
              <button type="submit">添加习惯</button>
            </form>
            {habitStatus === 'loading' ? <p className="workspace-state">习惯加载中...</p> : null}
            <div className="module-list">
              {habits.map((habit) => (
                <div key={habit.id} className="module-row module-row-compact">
                  <strong>{habit.title}</strong>
                  <span>{habit.startDate} - {habit.endDate || '永久'}</span>
                  <button type="button" onClick={() => onDeleteHabit(habit.id)}>删除</button>
                </div>
              ))}
              {habitStatus !== 'loading' && habits.length === 0 ? <p className="workspace-empty">还没有习惯，先添加一个轻量目标。</p> : null}
            </div>
          </section>

          <section className="module-card" aria-label="场景管理">
            <div className="module-card-header">
              <h3>场景管理</h3>
              <span className="module-eyebrow">Scenes</span>
            </div>
            <form className="module-inline-form" onSubmit={onCreateScene}>
              <input aria-label="新场景名称" value={sceneDraft} onChange={(event) => onSceneDraftChange(event.target.value)} placeholder="例如 写作、运动、学习" />
              <button type="submit">添加场景</button>
            </form>
            <div className="module-list">
              {scenes.map((scene) => (
                <div key={scene.id} className="module-row">
                  <span className="legend-dot" style={{ '--legend-color': scene.color || '#7894df' }} />
                  <strong>{scene.title}</strong>
                  <span>{scene.color || '#7894df'}</span>
                  <button type="button" onClick={() => onDeleteScene(scene.id)}>删除</button>
                </div>
              ))}
              {scenes.length === 0 ? <p className="workspace-empty">还没有场景。</p> : null}
            </div>
          </section>
        </div>
      </section>
    );
  }

  return null;
}

function TimerSettingsDialog({ settings, onSettingChange, onAutoStartChange, onClose }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="workspace-settings-backdrop" onMouseDown={onClose}>
      <div
        className="settings-panel workspace-settings-dialog"
        role="dialog"
        aria-label="计时设置"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button type="button" className="workspace-settings-close" aria-label="关闭计时设置" onClick={onClose}>
          <X />
        </button>
        <div className="settings-panel-header">
          <p>计时设置</p>
          <span>轻轻调整你的专注节奏</span>
        </div>

        <div className="settings-grid">
          {SETTINGS_FIELDS.map((field) => (
            <label key={field.key} className="settings-field">
              <span>{field.label}</span>
              <input
                type="number"
                min="1"
                inputMode="numeric"
                value={settings[field.key]}
                onChange={(event) => onSettingChange(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>

        <label className="toggle-row">
          <span>自动开始下一阶段</span>
          <input type="checkbox" checked={settings.autoStartNextSession} onChange={onAutoStartChange} />
        </label>
      </div>
    </div>
  );
}

function StatsOverviewCard({ label, value }) {
  return (
    <div className="focus-stats-overview-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function WorkspaceTrendCard({ title, items, valueKey, maxValue, formatValue, percent = false }) {
  const visibleItems = items.length > 0 ? items : Array.from({ length: 7 }, (_, index) => ({
    label: `${index + 1}`,
    startDate: `empty-${index}`,
    [valueKey]: 0,
  }));

  return (
    <section className="focus-stats-chart-card workspace-stats-card">
      <div className="focus-stats-chart-header">
        <h3>{title}</h3>
      </div>
      <div className={`focus-stats-chart ${percent ? 'percent' : ''}`}>
        <div className="focus-stats-chart-axis" aria-hidden="true">
          <span>{percent ? '100%' : formatValue(maxValue)}</span>
          <span>{percent ? '50%' : formatValue(Math.floor(maxValue / 2))}</span>
          <span>{percent ? '0%' : formatValue(0)}</span>
        </div>
        <div className="focus-stats-chart-bars">
          {visibleItems.slice(-7).map((item, index) => {
            const value = item[valueKey] ?? 0;
            const height = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
            return (
              <div key={`${item.startDate || index}-${title}`} className="focus-stats-chart-bar-item">
                <span className="focus-stats-chart-track workspace-stats-track" aria-label={`${item.label} ${title}`}>
                  <span style={{ height: `${height}%` }} />
                </span>
                <small>{item.label}</small>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WorkspaceSceneDistributionCard({ items }) {
  const visibleItems = items.length > 0 ? items : Array.from({ length: 7 }, (_, index) => ({
    label: `${index + 1}`,
    startDate: `empty-scene-${index}`,
    durationSeconds: 0,
    scenes: [],
  }));
  const legend = [];
  const seenSceneKeys = new Set();
  visibleItems.forEach((item) => {
    (item.scenes ?? []).forEach((scene, index) => {
      const key = `${scene.sceneId ?? index}:${scene.title}`;
      if (seenSceneKeys.has(key)) return;
      seenSceneKeys.add(key);
      legend.push(scene);
    });
  });

  return (
    <section className="focus-stats-chart-card workspace-stats-card">
      <div className="focus-stats-chart-header">
        <h3>最近场景分布</h3>
      </div>
      <div className="focus-stats-scene-chart">
        <div className="focus-stats-chart-axis" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="focus-stats-scene-bars">
          {visibleItems.slice(-7).map((item, itemIndex) => {
            const scenes = item.scenes ?? [];
            return (
              <div key={`${item.startDate || itemIndex}-scenes`} className="focus-stats-scene-bar-item">
                <span className="focus-stats-scene-track workspace-stats-track" aria-label={`${item.label} 场景分布`}>
                  {item.durationSeconds > 0 && scenes.length > 0 ? (
                    scenes.map((scene, sceneIndex) => (
                      <span
                        key={`${scene.sceneId ?? sceneIndex}-${scene.title}`}
                        className="focus-stats-scene-segment"
                        style={{
                          height: `${Math.max(2, scene.percentage ?? 0)}%`,
                          '--scene-color': getSceneColor(scene, sceneIndex),
                        }}
                      />
                    ))
                  ) : (
                    <span className="focus-stats-scene-empty" />
                  )}
                </span>
                <small>{item.label}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="focus-stats-scene-legend" aria-label="场景图例">
        {legend.length > 0 ? legend.slice(0, 5).map((scene, index) => (
          <span key={`${scene.sceneId ?? index}-${scene.title}`}>
            <i style={{ '--scene-color': getSceneColor(scene, index) }} />
            {scene.title}
          </span>
        )) : (
          <span>
            <i style={{ '--scene-color': '#8ca39a' }} />
            暂无场景数据
          </span>
        )}
      </div>
    </section>
  );
}

function WorkspaceHabitWeekCard({ days }) {
  const visibleDays = days.length > 0 ? days : ['一', '二', '三', '四', '五', '六', '日'].map((label, index) => ({
    date: `empty-habit-${index}`,
    label,
    total: 0,
    checked: 0,
    completion: 0,
  }));

  return (
    <section className="focus-stats-habits workspace-stats-card" aria-label="本周打卡进度">
      <h3>本周打卡进度</h3>
      <div className="focus-stats-habit-row">
        {visibleDays.map((day) => (
          <div key={day.date} className="focus-stats-habit-day workspace-stats-habit-day">
            <div className="focus-stats-habit-ring" style={{ '--habit-progress': `${day.completion ?? 0}%` }}>
              <span>{day.total > 0 ? `${day.checked}/${day.total}` : ''}</span>
            </div>
            <small>{day.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function ReviewDaySummary({ day }) {
  const items = [];
  if ((day?.focusSeconds || 0) >= 60) {
    items.push(`专注 ${formatDuration(day.focusSeconds)}`);
  }
  if ((day?.completedTasks || 0) > 0) {
    items.push(`任务 ${day.completedTasks}`);
  }
  if ((day?.completedHabits || 0) > 0) {
    items.push(`习惯 ${day.completedHabits}`);
  }
  if ((day?.sceneCount || 0) > 0) {
    items.push(`场景 ${day.sceneCount}`);
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="review-day-summary">
      {items.map((item) => <span key={item}>{item}</span>)}
    </div>
  );
}

function ReviewMonthCalendar({ calendar, todayDate, selectedDay, onSelectDay }) {
  const days = calendar?.days ?? [];
  return (
    <section className="review-calendar-shell" aria-label="月复盘">
      <div className="review-calendar">
        {WEEK_LABELS.map((label) => <div key={label} className="review-weekday">{label}</div>)}
        {days.map((day) => {
          const entries = day.entries ?? [];
          const visibleEntries = entries.slice(0, 3);
          const hiddenCount = Math.max(0, entries.length - visibleEntries.length);
          return (
            <button
              type="button"
              key={day.date}
              className={`review-day-cell ${day.inCurrentMonth ? '' : 'muted'} ${day.date === todayDate || day.isToday ? 'today' : ''} ${selectedDay?.date === day.date ? 'selected' : ''}`}
              aria-label={`${day.date} 复盘`}
              onClick={() => onSelectDay(day)}
            >
              <div className="review-day-topline">
                <span className="review-day-number">{day.day}</span>
                {day.date === todayDate || day.isToday ? <span className="review-today-chip">今天</span> : null}
              </div>
              <ReviewDaySummary day={day} />
              <div className="review-entry-list">
                {visibleEntries.map((entry, index) => (
                  <span
                    key={`${day.date}-${entry.type}-${entry.title}-${index}`}
                    className={`review-entry ${entry.type} ${entry.sceneColor ? 'with-scene-color' : ''}`}
                    style={entry.sceneColor ? { '--review-scene-color': entry.sceneColor } : undefined}
                  >
                    <span>{entry.title}</span>
                    {entry.meta ? <small>{entry.sceneTitle && entry.type !== 'scene' ? `${entry.sceneTitle} · ${entry.meta}` : entry.meta}</small> : null}
                  </span>
                ))}
                {hiddenCount > 0 ? <span className="review-entry-more">+{hiddenCount}</span> : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function hasWeekEventTime(event = {}) {
  return Boolean(event.startTime || event.endTime);
}

function ReviewWeekCard({ week, todayDate, selectedDay, onSelectDay, onPreviousWeek, onNextWeek, showHeader = true }) {
  const days = week?.days ?? createFallbackWeek(todayDate);
  return (
    <section className="week-card" aria-label="周日程">
      {showHeader ? (
        <div className="week-header">
          <button type="button" aria-label="上一周" onClick={onPreviousWeek}><CaretLeft /></button>
          <strong>{week?.startDate ? `${formatShortDate(week.startDate)} - ${formatShortDate(week.endDate)}` : '本周'}</strong>
          <button type="button" aria-label="下一周" onClick={onNextWeek}><CaretRight /></button>
        </div>
      ) : null}
      <div className="week-days">
        {days.map((day) => (
          <button
            type="button"
            key={day.date}
            className={`${day.date === todayDate || day.isToday ? 'today' : ''} ${selectedDay?.date === day.date ? 'selected' : ''}`}
            aria-label={`查看 ${day.date} 当日复盘`}
            onClick={() => onSelectDay(day)}
          >
            <span>{day.label?.replace('周', '') || getChineseWeekday(day.date).replace('周', '')}</span>
            <strong>{new Date(`${day.date}T00:00:00`).getDate()}</strong>
          </button>
        ))}
      </div>
      <div className="calendar-grid">
        <div className="calendar-time-column">
          {WEEK_TIMELINE_LABELS.map((mark) => (
            <span
              key={mark.label}
              className={mark.compressed ? 'is-compressed' : ''}
              style={{ '--time-top': `${mark.top ?? getWeekTimelinePercent(mark.minutes)}%` }}
            >
              {mark.label}
            </span>
          ))}
        </div>
        <div className="calendar-lines">
          <div className="calendar-hour-lines" aria-hidden="true">
            {WEEK_TIMELINE_GRID_MARKS.map((mark) => (
              <span key={mark.label} style={{ '--line-top': `${getWeekTimelinePercent(mark.minutes)}%` }} />
            ))}
          </div>
          {days.map((day) => (
            <div key={day.date} className={`calendar-day-column ${day.date === todayDate || day.isToday ? 'today' : ''} ${selectedDay?.date === day.date ? 'selected' : ''}`}>
              <div className="calendar-all-day-row">
                {(day.events ?? []).filter((event) => !hasWeekEventTime(event)).slice(0, 2).map((event, eventIndex) => (
                  <button
                    type="button"
                    key={`${event.id || event.title}-all-day-${eventIndex}`}
                    className={`calendar-all-day-event ${event.type || 'event'}`}
                    aria-label={`查看 ${day.date} 当日复盘`}
                    title={event.title}
                    style={{ '--event-color': event.color || REVIEW_COLORS[eventIndex % REVIEW_COLORS.length] }}
                    onClick={(eventClick) => {
                      eventClick.stopPropagation();
                      onSelectDay(day);
                    }}
                  >
                    {event.title}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="calendar-day-hitbox"
                aria-label={`查看 ${day.date} 当日复盘`}
                onClick={() => onSelectDay(day)}
              />
              {(day.events ?? []).filter(hasWeekEventTime).map((event, eventIndex) => (
                <button
                  type="button"
                  key={`${event.id || event.title}-${eventIndex}`}
                  className={`calendar-event ${event.type || 'event'}`}
                  aria-label={`查看 ${day.date} 当日复盘`}
                  title={`${event.title} ${event.startTime || ''}-${event.endTime || ''}`}
                  style={{
                    '--event-color': event.color || REVIEW_COLORS[eventIndex % REVIEW_COLORS.length],
                    ...getCalendarEventStyle(event),
                  }}
                  onClick={(eventClick) => {
                    eventClick.stopPropagation();
                    onSelectDay(day);
                  }}
                >
                  <strong>{event.title}</strong>
                  <span>{formatWeekEventTime(event)}</span>
                  {event.meta ? <small>{event.meta}</small> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatShortDate(dateValue) {
  const date = new Date(`${dateValue}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function getWeekTimelinePercent(minutes) {
  const clamped = Math.max(0, Math.min(WEEK_DAY_MINUTES, minutes));
  if (clamped <= WEEK_EARLY_END_MINUTES) {
    return (clamped / WEEK_EARLY_END_MINUTES) * (100 / WEEK_TIMELINE_SEGMENTS);
  }
  if (clamped < WEEK_LATE_START_MINUTES) {
    return ((1 + ((clamped - WEEK_EARLY_END_MINUTES) / 60)) / WEEK_TIMELINE_SEGMENTS) * 100;
  }
  const lateProgress = (clamped - WEEK_LATE_START_MINUTES) / (WEEK_DAY_MINUTES - WEEK_LATE_START_MINUTES);
  return (((WEEK_TIMELINE_SEGMENTS - 1) + lateProgress) / WEEK_TIMELINE_SEGMENTS) * 100;
}

function getCalendarEventStyle(event) {
  const [rawStartHour = 12, rawStartMinute = 0] = String(event.startTime || '12:00').split(':').map(Number);
  const startHour = Number.isFinite(rawStartHour) ? rawStartHour : 12;
  const startMinute = Number.isFinite(rawStartMinute) ? rawStartMinute : 0;
  const startMinutes = Math.max(0, Math.min(24 * 60, startHour * 60 + startMinute));
  const durationMinutes = Math.max(20, Math.round((event.durationSeconds || 30 * 60) / 60));
  const [rawEndHour, rawEndMinute = 0] = String(event.endTime || '').split(':').map(Number);
  const parsedEndMinutes = Number.isFinite(rawEndHour)
    ? Math.max(0, Math.min(24 * 60, rawEndHour * 60 + (Number.isFinite(rawEndMinute) ? rawEndMinute : 0)))
    : null;
  const endMinutes = parsedEndMinutes && parsedEndMinutes > startMinutes
    ? parsedEndMinutes
    : startMinutes + durationMinutes;
  const heightMinutes = Math.max(20, endMinutes - startMinutes, durationMinutes);
  const clampedEndMinutes = Math.min(24 * 60, startMinutes + heightMinutes);
  const eventTop = getWeekTimelinePercent(startMinutes);
  const eventHeight = Math.max(3.5, getWeekTimelinePercent(clampedEndMinutes) - eventTop);
  return {
    '--event-top': `${eventTop}%`,
    '--event-height': `${eventHeight}%`,
  };
}

function formatWeekEventTime(event = {}) {
  if (!event.startTime && !event.endTime) {
    return '全天';
  }
  if (!event.endTime || event.endTime === event.startTime) {
    return event.startTime || event.endTime;
  }
  return `${event.startTime}-${event.endTime}`;
}

function createFallbackWeek(todayDate) {
  const today = new Date(`${todayDate}T00:00:00`);
  const start = new Date(today);
  start.setDate(today.getDate() - today.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const value = getLocalDate(date);
    return {
      date: value,
      label: getChineseWeekday(value),
      events: [],
    };
  });
}

export default function HomePage({ user, onLoggedOut }) {
  const now = useNow();
  const todayDate = getLocalDate(now);
  const focusStartRemainingRef = useRef(null);
  const [activeSection, setActiveSection] = useState('plan');
  const [todos, setTodos] = useState([]);
  const [todoStatus, setTodoStatus] = useState('loading');
  const [todoError, setTodoError] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [settings, setSettings] = useState(() => createDefaultSettings());
  const [timerState, setTimerState] = useState(() => createInitialTimerState(createDefaultSettings()));
  const [selectedFocusTodo, setSelectedFocusTodo] = useState(null);
  const [habits, setHabits] = useState([]);
  const [habitStatus, setHabitStatus] = useState('idle');
  const [habitDraft, setHabitDraft] = useState('');
  const [sceneDraft, setSceneDraft] = useState('');
  const [scenes, setScenes] = useState([]);
  const [selectedScene, setSelectedScene] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [todayFocusSeconds, setTodayFocusSeconds] = useState(0);
  const [stats, setStats] = useState(null);
  const [reviewRefreshSignal, setReviewRefreshSignal] = useState(0);

  const loadTodos = useCallback(() => {
    setTodoStatus('loading');
    listTodos({ status: 'all' })
      .then((items) => {
        setTodos(items);
        setTodoStatus('ready');
        setTodoError('');
      })
      .catch((error) => {
        setTodoStatus('error');
        setTodoError(error instanceof Error ? error.message : '任务加载失败');
      });
  }, []);

  const loadReview = useCallback(() => {
    getFocusSessionSummary(todayDate)
      .then((summary) => setTodayFocusSeconds(summary?.durationSeconds ?? 0))
      .catch(() => setTodayFocusSeconds(0));
    getFocusStats({ period: 'day' })
      .then(setStats)
      .catch(() => setStats(null));
    setReviewRefreshSignal((signal) => signal + 1);
  }, [todayDate]);

  useEffect(() => {
    loadTodos();
  }, [loadTodos]);

  useEffect(() => {
    getPomodoroSettings()
      .then((savedSettings) => {
        if (!savedSettings) return;
        const nextSettings = { ...createDefaultSettings(), ...savedSettings };
        setSettings(nextSettings);
        setTimerState((state) => applySettingsToTimerState(state, nextSettings));
      })
      .catch(() => {});

    listScenes()
      .then((items) => {
        setScenes(items);
        setSelectedScene((current) => (
          current && items.some((scene) => scene.id === current.id) ? current : null
        ));
      })
      .catch(() => {
        setScenes([]);
        setSelectedScene(null);
      });
  }, []);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  useEffect(() => {
    if (activeSection !== 'manage') {
      return undefined;
    }

    let disposed = false;
    setHabitStatus('loading');
    listHabits()
      .then((items) => {
        if (disposed) return;
        setHabits(items);
        setHabitStatus('idle');
      })
      .catch(() => {
        if (disposed) return;
        setHabitStatus('error');
      });

    return () => {
      disposed = true;
    };
  }, [activeSection]);

  useEffect(() => {
    if (!timerState.isRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTimerState((state) => getNextTimerState(state, 'tick', settings));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [settings, timerState.isRunning]);

  const persistFocusDuration = async () => {
    if (timerState.phase !== TIMER_PHASES.FOCUS) {
      return;
    }
    const startRemaining = focusStartRemainingRef.current ?? timerState.totalSeconds;
    const durationSeconds = Math.max(0, startRemaining - timerState.remainingSeconds);
    if (durationSeconds < 5) {
      return;
    }

    await recordFocusSession({
      todoId: selectedFocusTodo?.id ? Number(selectedFocusTodo.id) : 0,
      sceneId: selectedScene?.id ? Number(selectedScene.id) : 0,
      durationSeconds,
      sessionDate: todayDate,
    });
    focusStartRemainingRef.current = timerState.remainingSeconds;
    setTodayFocusSeconds((seconds) => seconds + durationSeconds);
    loadReview();
  };

  const handleTimerAction = async (action) => {
    if (action === 'start') {
      focusStartRemainingRef.current = timerState.phase === TIMER_PHASES.FOCUS
        ? timerState.remainingSeconds
        : null;
      setTimerState((state) => getNextTimerState(state, action, settings));
      return;
    }

    if (timerState.isRunning && ['pause', 'endFocus', 'skipFocusCompleted'].includes(action)) {
      try {
        await persistFocusDuration();
      } catch {
        // Timer controls should still respond if the network write fails.
      }
    }

    if (['reset', 'endFocus', 'skipBreak', 'skipFocusCompleted'].includes(action)) {
      focusStartRemainingRef.current = null;
    }

    setTimerState((state) => getNextTimerState(state, action, settings));
  };

  const handleCreateTodo = async (input) => {
    const {
      title,
      priority = 'medium',
      startDate = todayDate,
      endDate = startDate,
    } = input;
    const normalizedStartDate = startDate || todayDate;
    const normalizedEndDate = endDate && endDate >= normalizedStartDate ? endDate : normalizedStartDate;
    try {
      const todo = await createTodo({
        title,
        todoDate: normalizedStartDate,
        timeType: 'date_range',
        startDate: normalizedStartDate,
        endDate: normalizedEndDate,
        priority,
      });
      setTodos((items) => [todo, ...items]);
      setActiveFilter('all');
      setTodoStatus('ready');
      setTodoError('');
    } catch (error) {
      setTodoError(error instanceof Error ? error.message : '任务保存失败');
    }
  };

  const handleToggleTodo = async (todo) => {
    const nextCompleted = !todo.completed;
    const previousTodos = todos;
    setTodos((items) => items.map((item) => (item.id === todo.id ? { ...item, completed: nextCompleted } : item)));
    if (selectedFocusTodo?.id === todo.id && nextCompleted) {
      try {
        await persistFocusDuration();
      } catch {
        // Completing a task should still update the task even if the last segment cannot be saved.
      }
      setSelectedFocusTodo(null);
    }
    try {
      await updateTodo(todo.id, { completed: nextCompleted });
      loadReview();
    } catch (error) {
      setTodos(previousTodos);
      setTodoError(error instanceof Error ? error.message : '更新任务失败');
    }
  };

  const handleDeleteTodo = async (todo) => {
    const previousTodos = todos;
    setTodos((items) => items.filter((item) => item.id !== todo.id));
    if (selectedFocusTodo?.id === todo.id) {
      setSelectedFocusTodo(null);
    }

    try {
      await deleteTodo(todo.id);
      loadReview();
    } catch (error) {
      setTodos(previousTodos);
      setTodoError(error instanceof Error ? error.message : '删除任务失败');
    }
  };

  const handleFocusTodo = (todo) => {
    if (todo.completed) {
      return;
    }
    setSelectedFocusTodo(todo);
    focusStartRemainingRef.current = timerState.phase === TIMER_PHASES.FOCUS ? timerState.remainingSeconds : null;
    setTimerState((state) => (
      state.phase === TIMER_PHASES.FOCUS && !state.isRunning
        ? getNextTimerState(state, 'start', settings)
        : state
    ));
  };

  const handleCreateHabit = async (event) => {
    event.preventDefault();
    const title = habitDraft.trim();
    if (!title) return;

    const habit = await createHabit({
      title,
      startDate: todayDate,
      endDate: '',
    });
    setHabits((items) => [habit, ...items.filter((item) => item.id !== habit.id)]);
    setHabitDraft('');
    loadTodos();
    loadReview();
  };

  const handleDeleteHabit = async (habitId) => {
    const previousHabits = habits;
    setHabits((items) => items.filter((habit) => habit.id !== habitId));
    try {
      await deleteHabit(habitId);
      loadTodos();
      loadReview();
    } catch {
      setHabits(previousHabits);
    }
  };

  const handleCreateScene = async (event) => {
    event.preventDefault();
    const title = sceneDraft.trim();
    if (!title) return;

    const scene = await createScene({ title, color: REVIEW_COLORS[scenes.length % REVIEW_COLORS.length] });
    setScenes((items) => [scene, ...items.filter((item) => item.id !== scene.id)]);
    setSelectedScene((current) => current ?? scene);
    setSceneDraft('');
  };

  const handleDeleteScene = async (sceneId) => {
    const previousScenes = scenes;
    setScenes((items) => items.filter((scene) => scene.id !== sceneId));
    setSelectedScene((current) => (current?.id === sceneId ? null : current));
    try {
      await deleteScene(sceneId);
      loadReview();
    } catch {
      setScenes(previousScenes);
    }
  };

  const persistSettings = (nextSettings) => {
    setSettings(nextSettings);
    setTimerState((state) => applySettingsToTimerState(state, nextSettings));
    updatePomodoroSettings(nextSettings).catch(() => {});
  };

  const handleSettingChange = (key, value) => {
    const numericValue = Math.max(1, Number(value) || 1);
    persistSettings({ ...settings, [key]: numericValue });
  };

  const handleAutoStartChange = () => {
    persistSettings({ ...settings, autoStartNextSession: !settings.autoStartNextSession });
  };

  const handleLogout = async () => {
    try {
      await persistFocusDuration();
    } catch {
      // Logging out should not trap the user if the last focus segment cannot be saved.
    }
    await logout();
    onLoggedOut();
  };

  const focusCopy = timerState.phase === TIMER_PHASES.FOCUS && selectedFocusTodo
    ? `把注意力留给${selectedFocusTodo.title}`
    : timerState.phase === TIMER_PHASES.FOCUS
      ? '把注意力留给眼前这一件事。'
      : '休息一下，让下一轮更稳。';

  const focusTimerStatus = selectedFocusTodo ? {
    todoId: selectedFocusTodo.id,
    phase: timerState.phase,
    remainingSeconds: timerState.remainingSeconds,
    isRunning: timerState.isRunning,
  } : null;
  const isModuleSection = ['stats', 'review', 'manage'].includes(activeSection);

  return (
    <div className={`workspace-shell workspace-section-${activeSection}`}>
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onLogout={handleLogout}
      />
      <TaskPanel
        todos={todos}
        status={todoStatus}
        errorMessage={todoError}
        activeFilter={activeFilter}
        todayDate={todayDate}
        focusTimerStatus={focusTimerStatus}
        onFilterChange={setActiveFilter}
        onCreateTodo={handleCreateTodo}
        onToggleTodo={handleToggleTodo}
        onDeleteTodo={handleDeleteTodo}
        onFocusTodo={handleFocusTodo}
      />
      {activeSection === 'review' ? (
        <ReviewPanel stats={stats} todayDate={todayDate} refreshSignal={reviewRefreshSignal} variant="module" />
      ) : isModuleSection ? (
        <WorkspaceModulePanel
          activeSection={activeSection}
          stats={stats}
          habits={habits}
          habitStatus={habitStatus}
          habitDraft={habitDraft}
          sceneDraft={sceneDraft}
          scenes={scenes}
          onHabitDraftChange={setHabitDraft}
          onSceneDraftChange={setSceneDraft}
          onCreateHabit={handleCreateHabit}
          onDeleteHabit={handleDeleteHabit}
          onCreateScene={handleCreateScene}
          onDeleteScene={handleDeleteScene}
        />
      ) : (
        <>
          <FocusPanel
            settings={settings}
            timerState={timerState}
            focusCopy={focusCopy}
            selectedScene={selectedScene}
            scenes={scenes}
            todayFocusSeconds={todayFocusSeconds}
            onTimerAction={handleTimerAction}
            onSceneChange={setSelectedScene}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          <ReviewPanel stats={stats} todayDate={todayDate} refreshSignal={reviewRefreshSignal} />
        </>
      )}
      {isSettingsOpen ? (
        <TimerSettingsDialog
          settings={settings}
          onSettingChange={handleSettingChange}
          onAutoStartChange={handleAutoStartChange}
          onClose={() => setIsSettingsOpen(false)}
        />
      ) : null}
    </div>
  );
}
