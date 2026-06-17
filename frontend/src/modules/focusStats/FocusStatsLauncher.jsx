import { useEffect, useRef, useState } from 'react';
import { getFocusStats } from '../../lib/api';

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 19V9h3v10H5Zm5.5 0V5h3v14h-3Zm5.5 0v-7h3v7h-3ZM4 21h16v-2H4v2Z" fill="currentColor" />
    </svg>
  );
}

function formatDuration(seconds = 0) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

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

function getDayLabel(date) {
  const parts = date.split('-');
  return parts.length === 3 ? `${Number(parts[1])}/${Number(parts[2])}` : date;
}

export default function FocusStatsLauncher({ refreshSignal = 0 } = {}) {
  const [isOpen, setIsOpen] = useState(false);
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
    getFocusStats()
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
  }, [isOpen, refreshSignal]);

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

  const dailyStats = stats?.daily ?? [];
  const maxDailySeconds = Math.max(1, ...dailyStats.map((day) => day.durationSeconds));
  const taskStats = stats?.byTask ?? [];
  const recentStats = stats?.recent ?? [];

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
            {stats ? <span>{getDayLabel(stats.startDate)} - {getDayLabel(stats.endDate)}</span> : null}
          </div>

          {status === 'loading' ? <p className="focus-stats-state">统计加载中...</p> : null}
          {errorMessage ? <p className="focus-stats-error" role="alert">{errorMessage}</p> : null}

          {stats ? (
            <>
              <div className="focus-stats-summary">
                <div>
                  <span>总专注</span>
                  <strong>{formatDuration(stats.summary.durationSeconds)}</strong>
                </div>
                <div>
                  <span>专注次数</span>
                  <strong>{stats.summary.sessionCount} 次</strong>
                </div>
              </div>

              <div className="focus-stats-section">
                <p className="focus-stats-section-title">近七天趋势</p>
                <div className="focus-stats-bars">
                  {dailyStats.map((day) => (
                    <div key={day.date} className="focus-stats-bar-item">
                      <div className="focus-stats-bar-track">
                        <span style={{ height: `${Math.max(8, (day.durationSeconds / maxDailySeconds) * 100)}%` }} />
                      </div>
                      <small>{getDayLabel(day.date)}</small>
                    </div>
                  ))}
                </div>
              </div>

              <div className="focus-stats-section">
                <p className="focus-stats-section-title">任务分布</p>
                {taskStats.length > 0 ? (
                  <div className="focus-stats-task-list">
                    {taskStats.map((task) => (
                      <div key={task.todoId} className="focus-stats-task-item">
                        <span>{task.title}</span>
                        <strong>{formatDuration(task.durationSeconds)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="focus-stats-state">还没有任务专注记录</p>
                )}
              </div>

              <div className="focus-stats-section">
                <p className="focus-stats-section-title">最近记录</p>
                {recentStats.length > 0 ? (
                  <div className="focus-stats-recent-list">
                    {recentStats.map((entry) => (
                      <div key={`${entry.todoId}-${entry.createdAt}`} className="focus-stats-recent-item">
                        <span>{entry.title}</span>
                        <strong>{formatDuration(entry.durationSeconds)}</strong>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="focus-stats-state">暂无最近记录</p>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
