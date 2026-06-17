import { useEffect, useMemo, useRef, useState } from 'react';
import { deleteReviewTodo, getReviewCalendar } from '../../lib/api';

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 2h2v3h6V2h2v3h2.5A2.5 2.5 0 0 1 22 7.5v11A2.5 2.5 0 0 1 19.5 21h-15A2.5 2.5 0 0 1 2 18.5v-11A2.5 2.5 0 0 1 4.5 5H7V2Zm12.5 8h-15v8.5h15V10ZM4.5 8h15v-.5a.5.5 0 0 0-.5-.5H5a.5.5 0 0 0-.5.5V8Z" fill="currentColor" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m14.8 5.6 1.4 1.4-5 5 5 5-1.4 1.4L8.4 12l6.4-6.4Z" fill="currentColor" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.2 18.4 7.8 17l5-5-5-5 1.4-1.4 6.4 6.4-6.4 6.4Z" fill="currentColor" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10l-.7 11H7.7L7 9Zm3 2v7h2v-7h-2Zm3 0v7h2v-7h-2Z" fill="currentColor" />
    </svg>
  );
}

function getCurrentMonth() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

function shiftMonth(value, offset) {
  const date = new Date(value.year, value.month - 1 + offset, 1);
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
  };
}

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h${minutes}m`;
  }
  return `${minutes}m`;
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

function getSceneStyle(color) {
  return color ? { '--review-scene-color': color } : undefined;
}

function getReviewTaskMeta(task) {
  const focusMeta = `专注 ${formatDetailDuration(task.focusSeconds)} · ${task.sessionCount} 个番茄`;
  if (task.sourceType === 'scene') {
    return `场景 ${task.sceneTitle || task.title || '默认'} · ${focusMeta}`;
  }
  return `${task.completed ? '已完成' : '未完成'} · 场景 ${task.sceneTitle || '默认'} · ${focusMeta}`;
}

function DaySummary({ day }) {
  const items = [];
  if (day.focusSeconds > 0) {
    items.push(`专注 ${formatDuration(day.focusSeconds)}`);
  }
  if (day.completedTasks > 0) {
    items.push(`任务 ${day.completedTasks}`);
  }
  if (day.completedHabits > 0) {
    items.push(`习惯 ${day.completedHabits}`);
  }
  if (day.sceneCount > 0) {
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

export default function ReviewCalendarLauncher({ refreshSignal = 0 } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => getCurrentMonth());
  const [calendar, setCalendar] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteStatus, setDeleteStatus] = useState('idle');
  const [detailErrorMessage, setDetailErrorMessage] = useState('');
  const launcherRef = useRef(null);
  const detailRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isDisposed = false;
    setStatus('loading');
    getReviewCalendar(viewMonth)
      .then((nextCalendar) => {
        if (isDisposed) {
          return;
        }
        setCalendar(nextCalendar);
        setStatus('ready');
        setErrorMessage('');
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '个人复盘暂时不可用');
      });

    return () => {
      isDisposed = true;
    };
  }, [isOpen, viewMonth, refreshSignal]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleMouseDown = (event) => {
      if (launcherRef.current?.contains(event.target)) {
        return;
      }
      setIsOpen(false);
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedDate) {
      return undefined;
    }

    const handleMouseDown = (event) => {
      if (detailRef.current?.contains(event.target)) {
        return;
      }
      setSelectedDate('');
      setDetailErrorMessage('');
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, selectedDate]);

  const monthTitle = useMemo(() => `${viewMonth.year}年${viewMonth.month}月`, [viewMonth]);
  const selectedDay = useMemo(() => (
    calendar?.days.find((day) => day.date === selectedDate) ?? null
  ), [calendar, selectedDate]);

  const handleDeleteTask = async (task) => {
    const confirmed = window.confirm(`永久删除「${task.title}」以及它的全部专注记录？这个操作不能撤销。`);
    if (!confirmed) {
      return;
    }

    setDeleteStatus('deleting');
    setDetailErrorMessage('');
    try {
      await deleteReviewTodo(task.todoId);
      const nextCalendar = await getReviewCalendar(viewMonth);
      setCalendar(nextCalendar);
      setSelectedDate((date) => {
        const nextDay = nextCalendar.days.find((day) => day.date === date);
        return nextDay ? date : '';
      });
      setDeleteStatus('idle');
    } catch (error) {
      setDeleteStatus('error');
      setDetailErrorMessage(error instanceof Error ? error.message : '永久删除失败');
    }
  };

  return (
    <div className="review-launcher" ref={launcherRef}>
      <button
        type="button"
        className={`mode-switch-button has-tooltip ${isOpen ? 'active' : ''}`}
        aria-label="打开个人复盘"
        aria-pressed={isOpen}
        data-tooltip="个人复盘"
        onClick={() => setIsOpen((open) => !open)}
      >
        <CalendarIcon />
      </button>

      {isOpen ? (
        <section className="review-panel" role="dialog" aria-label="个人复盘">
          <div className="review-panel-header">
            <div>
              <p className="review-kicker">Personal Review</p>
              <p className="review-title">个人复盘</p>
            </div>
            <div className="review-month-controls">
              <button type="button" className="review-icon-button has-tooltip" aria-label="上个月" data-tooltip="上个月" onClick={() => setViewMonth((month) => shiftMonth(month, -1))}>
                <ChevronLeftIcon />
              </button>
              <strong>{monthTitle}</strong>
              <button type="button" className="review-icon-button has-tooltip" aria-label="下个月" data-tooltip="下个月" onClick={() => setViewMonth((month) => shiftMonth(month, 1))}>
                <ChevronRightIcon />
              </button>
              <button type="button" className="review-today-button" onClick={() => setViewMonth(getCurrentMonth())}>
                今天
              </button>
            </div>
          </div>

          {status === 'loading' ? <p className="review-state">复盘加载中...</p> : null}
          {errorMessage ? <p className="review-error" role="alert">{errorMessage}</p> : null}

          {calendar ? (
            <div className="review-calendar" aria-label={`${monthTitle}复盘日历`}>
              {WEEK_LABELS.map((label) => <div key={label} className="review-weekday">{label}</div>)}
              {calendar.days.map((day) => (
                <button
                  type="button"
                  key={day.date}
                  className={`review-day-cell ${day.inCurrentMonth ? '' : 'muted'} ${day.isToday ? 'today' : ''}`}
                  aria-label={`${day.date} 复盘`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => {
                    setSelectedDate((date) => (date === day.date ? '' : day.date));
                    setDetailErrorMessage('');
                  }}
                >
                  <div className="review-day-topline">
                    <span className="review-day-number">{day.day}</span>
                    {day.isToday ? <span className="review-today-chip">今天</span> : null}
                  </div>
                  <DaySummary day={day} />
                  <div className="review-entry-list">
                    {day.entries.map((entry, index) => (
                      <div
                        key={`${day.date}-${entry.type}-${entry.title}-${index}`}
                        className={`review-entry ${entry.type} ${entry.sceneColor ? 'with-scene-color' : ''}`}
                        style={getSceneStyle(entry.sceneColor)}
                      >
                        <span>{entry.title}</span>
                        {entry.meta ? <small>{entry.sceneTitle && entry.type !== 'scene' ? `${entry.sceneTitle} · ${entry.meta}` : entry.meta}</small> : null}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {selectedDay ? (
            <section className="review-detail-panel" role="dialog" aria-label={`${selectedDay.date} 当日复盘详情`} ref={detailRef}>
              <div className="review-detail-header">
                <div>
                  <p className="review-kicker">Day Detail</p>
                  <h3>{selectedDay.date} 复盘详情</h3>
                </div>
                <button type="button" className="review-today-button" onClick={() => setSelectedDate('')}>
                  关闭
                </button>
              </div>
              <div className="review-detail-summary">
                <span>任务 {selectedDay.completedTasks}</span>
                <span>习惯 {selectedDay.completedHabits}</span>
                <span>场景 {selectedDay.sceneCount}</span>
                <span>专注 {formatDuration(selectedDay.focusSeconds)}</span>
              </div>
              {detailErrorMessage ? <p className="review-error" role="alert">{detailErrorMessage}</p> : null}
              <div className="review-task-list">
                {selectedDay.tasks.length > 0 ? selectedDay.tasks.map((task) => (
                  <article
                    key={`${task.sourceType}-${task.todoId || task.sceneId}`}
                    className={`review-task-row ${task.sceneColor ? 'with-scene-color' : ''}`}
                    style={getSceneStyle(task.sceneColor)}
                  >
                    <div className="review-task-main">
                      <span className={`review-task-badge ${task.sourceType}`}>{task.sourceType === 'habit' ? '习惯' : task.sourceType === 'scene' ? '场景' : '任务'}</span>
                      <strong>{task.title}</strong>
                      <small>{getReviewTaskMeta(task)}</small>
                    </div>
                    {task.sourceType !== 'scene' ? (
                      <button
                        type="button"
                        className="review-delete-button has-tooltip"
                        aria-label={`永久删除 ${task.title}`}
                        data-tooltip="永久删除"
                        disabled={deleteStatus === 'deleting'}
                        onClick={() => handleDeleteTask(task)}
                      >
                        <TrashIcon />
                      </button>
                    ) : null}
                  </article>
                )) : (
                  <p className="review-empty">这一天还没有可复盘的任务。</p>
                )}
              </div>
            </section>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
