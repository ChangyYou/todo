import { useEffect, useRef, useState } from 'react';
import { getFocusStats } from '../../lib/api';

const PERIOD_OPTIONS = [
  { value: 'day', label: '日' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
];

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V9h3v10H5Zm5.5 0V5h3v14h-3Zm5.5 0v-7h3v7h-3ZM4 21h16v-2H4v2Z" fill="currentColor" />
    </svg>
  );
}

function formatDuration(seconds = 0, compact = false) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (compact) {
    return `${hours}h${minutes}m`;
  }
  if (hours > 0 && minutes > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (hours > 0) {
    return `${hours}小时`;
  }
  if (minutes > 0) {
    return `${minutes}分钟`;
  }
  return '0分钟';
}

function StatCard({ label, value }) {
  return (
    <div className="focus-stats-overview-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PeriodSelect({ value, onChange }) {
  return (
    <label className="focus-stats-period-select">
      <span className="sr-only">统计周期</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {PERIOD_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function getTrendTooltip(item, valueKey, formatValue) {
  const value = item[valueKey] ?? 0;
  if (valueKey === 'durationSeconds') {
    return `${item.label}：专注 ${formatDuration(value)}；${item.sessionCount ?? 0} 个番茄`;
  }
  if (valueKey === 'taskCompletionRate') {
    return `${item.label}：完成率 ${formatValue(value)}；完成 ${item.taskCompleted ?? 0}/${item.taskTotal ?? 0}`;
  }
  if (valueKey === 'sessionCount') {
    return `${item.label}：${value} 个番茄；专注 ${formatDuration(item.durationSeconds ?? 0)}`;
  }
  return `${item.label}：${formatValue(value)}`;
}

function getHabitTooltip(day) {
  const completed = day.completedHabits ?? [];
  const pending = day.pendingHabits ?? [];
  const completedText = completed.length > 0 ? completed.join('、') : '无';
  const pendingText = pending.length > 0 ? pending.join('、') : '无';
  return `${day.date}：已完成 ${completedText}；未完成 ${pendingText}`;
}

function TrendCard({ title, period, onPeriodChange, items, valueKey, maxValue, formatValue, percent = false }) {
  return (
    <div className="focus-stats-chart-card">
      <div className="focus-stats-chart-header">
        <h3>{title}</h3>
        <PeriodSelect value={period} onChange={onPeriodChange} />
      </div>
      <div className={`focus-stats-chart ${percent ? 'percent' : ''}`}>
        <div className="focus-stats-chart-axis" aria-hidden="true">
          <span>{percent ? '100%' : formatValue(maxValue)}</span>
          <span>{percent ? '50%' : formatValue(Math.floor(maxValue / 2))}</span>
          <span>{percent ? '0%' : formatValue(0)}</span>
        </div>
        <div className="focus-stats-chart-bars">
          {items.map((item) => {
            const value = item[valueKey] ?? 0;
            const height = maxValue > 0 ? Math.max(4, (value / maxValue) * 100) : 4;
            const tooltip = getTrendTooltip(item, valueKey, formatValue);
            return (
              <div key={`${item.startDate}-${item.label}-${valueKey}`} className="focus-stats-chart-bar-item">
                <div className="focus-stats-chart-track" title={tooltip}>
                  <span style={{ height: `${height}%` }} />
                </div>
                <small>{item.label}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function FocusStatsLauncher({ refreshSignal = 0 } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState('day');
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const launcherRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    let isDisposed = false;
    setStatus('loading');
    getFocusStats({ period })
      .then((nextStats) => {
        if (isDisposed) {
          return;
        }
        setStats(nextStats);
        setStatus('ready');
        setErrorMessage('');
      })
      .catch((error) => {
        if (isDisposed) {
          return;
        }
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : '专注统计暂时不可用');
      });

    return () => {
      isDisposed = true;
    };
  }, [isOpen, period, refreshSignal]);

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

  const periods = stats?.periods ?? [];
  const overview = stats?.overview ?? {};
  const habitWeek = stats?.habitWeek ?? [];
  const maxFocusSeconds = Math.max(300, ...periods.map((item) => item.durationSeconds ?? 0));
  const maxPomodoros = Math.max(5, ...periods.map((item) => item.sessionCount ?? 0));

  return (
    <div className="focus-stats-launcher" ref={launcherRef}>
      <button
        type="button"
        className={`mode-switch-button has-tooltip ${isOpen ? 'active' : ''}`}
        aria-label="打开专注统计"
        aria-pressed={isOpen}
        data-tooltip="专注统计"
        onClick={() => setIsOpen((open) => !open)}
      >
        <ChartIcon />
      </button>

      {isOpen ? (
        <section className="focus-stats-panel" role="dialog" aria-label="专注统计">
          <div className="focus-stats-header">
            <div>
              <p className="focus-stats-kicker">Focus Stats</p>
              <p className="focus-stats-title">专注统计</p>
            </div>
            <PeriodSelect value={period} onChange={setPeriod} />
          </div>

          {status === 'loading' ? <p className="focus-stats-state">统计加载中...</p> : null}
          {errorMessage ? <p className="focus-stats-error" role="alert">{errorMessage}</p> : null}

          {stats ? (
            <div className="focus-stats-content">
              <section className="focus-stats-overview" aria-label="概览">
                <h3>概览</h3>
                <div className="focus-stats-overview-grid">
                  <StatCard label="今日已完成" value={overview.todayCompletedTasks ?? 0} />
                  <StatCard label="今日番茄" value={overview.todayPomodoros ?? 0} />
                  <StatCard label="今日专注时长" value={formatDuration(overview.todayFocusSeconds, true)} />
                  <StatCard label="总已完成" value={overview.totalCompletedTasks ?? 0} />
                  <StatCard label="总番茄" value={overview.totalPomodoros ?? 0} />
                  <StatCard label="总专注时长" value={formatDuration(overview.totalFocusSeconds, true)} />
                </div>
              </section>

              <TrendCard
                title="最近专注时长趋势"
                period={period}
                onPeriodChange={setPeriod}
                items={periods}
                valueKey="durationSeconds"
                maxValue={maxFocusSeconds}
                formatValue={(value) => `${Math.round(value / 60)}m`}
              />

              <TrendCard
                title="最近完成率趋势"
                period={period}
                onPeriodChange={setPeriod}
                items={periods}
                valueKey="taskCompletionRate"
                maxValue={100}
                formatValue={(value) => `${value}%`}
                percent
              />

              <TrendCard
                title="最近番茄数趋势"
                period={period}
                onPeriodChange={setPeriod}
                items={periods}
                valueKey="sessionCount"
                maxValue={maxPomodoros}
                formatValue={(value) => String(value)}
              />

              <section className="focus-stats-habits" aria-label="本周打卡进度">
                <h3>本周打卡进度</h3>
                <div className="focus-stats-habit-row">
                  {habitWeek.map((day) => (
                    <div key={day.date} className="focus-stats-habit-day" title={getHabitTooltip(day)}>
                      <div className="focus-stats-habit-ring" style={{ '--habit-progress': `${day.completion ?? 0}%` }}>
                        <span>{day.total > 0 ? `${day.checked}/${day.total}` : ''}</span>
                      </div>
                      <small>{day.label}</small>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
