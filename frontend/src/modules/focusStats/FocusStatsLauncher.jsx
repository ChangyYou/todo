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

function formatPercentage(value = 0) {
  return `${Math.round(value)}%`;
}

function sceneColor(color) {
  return color || '#8ca39a';
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

function buildTrendDetail(item, valueKey, formatValue) {
  const value = item[valueKey] ?? 0;
  const key = `trend:${valueKey}:${item.startDate}:${item.endDate}`;
  if (valueKey === 'durationSeconds') {
    return {
      key,
      title: `${item.label} 专注详情`,
      rows: [
        { label: '专注时长', value: formatDuration(value) },
        { label: '番茄数', value: `${item.sessionCount ?? 0} 个` },
        { label: '统计范围', value: `${item.startDate} - ${item.endDate}` },
      ],
    };
  }
  if (valueKey === 'taskCompletionRate') {
    return {
      key,
      title: `${item.label} 完成率详情`,
      rows: [
        { label: '完成率', value: formatValue(value) },
        { label: '完成情况', value: `${item.taskCompleted ?? 0}/${item.taskTotal ?? 0}` },
        { label: '统计范围', value: `${item.startDate} - ${item.endDate}` },
      ],
    };
  }
  if (valueKey === 'sessionCount') {
    return {
      key,
      title: `${item.label} 番茄详情`,
      rows: [
        { label: '番茄数', value: `${value} 个` },
        { label: '专注时长', value: formatDuration(item.durationSeconds ?? 0) },
        { label: '统计范围', value: `${item.startDate} - ${item.endDate}` },
      ],
    };
  }
  return {
    key,
    title: `${item.label} 统计详情`,
    rows: [{ label: '数值', value: formatValue(value) }],
  };
}

function buildHabitDetail(day) {
  const completed = day.completedHabits ?? [];
  const pending = day.pendingHabits ?? [];
  return {
    key: `habit:${day.date}`,
    title: `${day.date} 打卡详情`,
    rows: [
      { label: '完成情况', value: `${day.checked ?? 0}/${day.total ?? 0}` },
      { label: '完成率', value: `${day.completion ?? 0}%` },
    ],
    groups: [
      { label: '已完成', items: completed },
      { label: '未完成', items: pending },
    ],
  };
}

function buildSceneDetail(period) {
  const scenes = period.scenes ?? [];
  return {
    key: `scene:${period.startDate}:${period.endDate}`,
    title: `${period.label} 场景分布`,
    rows: [
      { label: '专注时长', value: formatDuration(period.durationSeconds ?? 0) },
      { label: '场景数量', value: `${scenes.length} 个` },
      { label: '统计范围', value: `${period.startDate} - ${period.endDate}` },
    ],
    groups: [
      {
        label: '分布明细',
        items: scenes.map((scene) => (
          `${scene.title}: ${formatDuration(scene.durationSeconds ?? 0)} · ${formatPercentage(scene.percentage ?? 0)} · ${scene.sessionCount ?? 0} 个番茄`
        )),
      },
    ],
  };
}

function DetailDialog({ detail, onClose, detailRef }) {
  if (!detail) {
    return null;
  }

  return (
    <section className="focus-stats-detail" role="dialog" aria-label={detail.title} ref={detailRef}>
      <div className="focus-stats-detail-header">
        <h3>{detail.title}</h3>
        <button type="button" onClick={onClose}>关闭</button>
      </div>
      <div className="focus-stats-detail-grid">
        {detail.rows.map((row) => (
          <div key={row.label} className="focus-stats-detail-row">
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
      {detail.groups?.length ? (
        <div className="focus-stats-detail-groups">
          {detail.groups.map((group) => (
            <div key={group.label} className="focus-stats-detail-group">
              <span>{group.label}</span>
              <p>{group.items.length > 0 ? group.items.join('、') : '无'}</p>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function TrendCard({ title, period, onPeriodChange, items, valueKey, maxValue, formatValue, percent = false, onSelect }) {
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
            return (
              <div key={`${item.startDate}-${item.label}-${valueKey}`} className="focus-stats-chart-bar-item">
                <button
                  type="button"
                  className="focus-stats-chart-track"
                  aria-label={`${item.label} ${title}详情`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(buildTrendDetail(item, valueKey, formatValue))}
                >
                  <span style={{ height: `${height}%` }} />
                </button>
                <small>{item.label}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SceneDistributionCard({ period, onPeriodChange, items, onSelect }) {
  const legend = [];
  const seenSceneKeys = new Set();
  items.forEach((item) => {
    (item.scenes ?? []).forEach((scene) => {
      const key = `${scene.sceneId}:${scene.title}`;
      if (seenSceneKeys.has(key)) {
        return;
      }
      seenSceneKeys.add(key);
      legend.push(scene);
    });
  });

  return (
    <section className="focus-stats-chart-card">
      <div className="focus-stats-chart-header">
        <h3>最近场景分布</h3>
        <PeriodSelect value={period} onChange={onPeriodChange} />
      </div>
      <div className="focus-stats-scene-chart">
        <div className="focus-stats-chart-axis" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div className="focus-stats-scene-bars">
          {items.map((item) => {
            const total = item.durationSeconds ?? 0;
            const scenes = item.scenes ?? [];
            return (
              <div key={`${item.startDate}-${item.endDate}-scenes`} className="focus-stats-scene-bar-item">
                <button
                  type="button"
                  className="focus-stats-scene-track"
                  aria-label={`${item.label} 场景分布详情`}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={() => onSelect(buildSceneDetail(item))}
                >
                  {total > 0 ? (
                    scenes.map((scene) => (
                      <span
                        key={`${scene.sceneId}-${scene.title}`}
                        className="focus-stats-scene-segment"
                        style={{
                          height: `${Math.max(2, scene.percentage ?? 0)}%`,
                          '--scene-color': sceneColor(scene.color),
                        }}
                      />
                    ))
                  ) : (
                    <span className="focus-stats-scene-empty" />
                  )}
                </button>
                <small>{item.label}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="focus-stats-scene-legend" aria-label="场景图例">
        {legend.length > 0 ? legend.slice(0, 5).map((scene) => (
          <span key={`${scene.sceneId}-${scene.title}`}>
            <i style={{ '--scene-color': sceneColor(scene.color) }} />
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

export default function FocusStatsLauncher({ refreshSignal = 0 } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [period, setPeriod] = useState('day');
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedDetail, setSelectedDetail] = useState(null);
  const launcherRef = useRef(null);
  const detailRef = useRef(null);

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
        setSelectedDetail(null);
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

  useEffect(() => {
    if (!isOpen || !selectedDetail) {
      return undefined;
    }

    const handleMouseDown = (event) => {
      if (detailRef.current?.contains(event.target)) {
        return;
      }
      setSelectedDetail(null);
    };

    window.addEventListener('mousedown', handleMouseDown);
    return () => window.removeEventListener('mousedown', handleMouseDown);
  }, [isOpen, selectedDetail]);

  const handleSelectDetail = (detail) => {
    setSelectedDetail((currentDetail) => (
      currentDetail?.key === detail.key ? null : detail
    ));
  };

  const periods = stats?.periods ?? [];
  const scenePeriods = stats?.scenePeriods ?? [];
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
                onSelect={handleSelectDetail}
              />

              <SceneDistributionCard
                period={period}
                onPeriodChange={setPeriod}
                items={scenePeriods}
                onSelect={handleSelectDetail}
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
                onSelect={handleSelectDetail}
              />

              <TrendCard
                title="最近番茄数趋势"
                period={period}
                onPeriodChange={setPeriod}
                items={periods}
                valueKey="sessionCount"
                maxValue={maxPomodoros}
                formatValue={(value) => String(value)}
                onSelect={handleSelectDetail}
              />

              <section className="focus-stats-habits" aria-label="本周打卡进度">
                <h3>本周打卡进度</h3>
                <div className="focus-stats-habit-row">
                  {habitWeek.map((day) => (
                    <button
                      type="button"
                      key={day.date}
                      className="focus-stats-habit-day"
                      aria-label={`${day.date} 打卡详情`}
                      onMouseDown={(event) => event.stopPropagation()}
                      onClick={() => handleSelectDetail(buildHabitDetail(day))}
                    >
                      <div className="focus-stats-habit-ring" style={{ '--habit-progress': `${day.completion ?? 0}%` }}>
                        <span>{day.total > 0 ? `${day.checked}/${day.total}` : ''}</span>
                      </div>
                      <small>{day.label}</small>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          <DetailDialog detail={selectedDetail} onClose={() => setSelectedDetail(null)} detailRef={detailRef} />
        </section>
      ) : null}
    </div>
  );
}
