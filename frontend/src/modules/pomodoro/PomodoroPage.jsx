import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import {
  applySettingsToTimerState,
  createDefaultSettings,
  createInitialTimerState,
  formatTime,
  getNextTimerState,
  TIMER_PHASES,
} from '../../lib/pomodoro';
import {
  MUSIC_STORAGE_KEY,
  createSavedPlaylistRecord,
  parseNeteasePlaylistInput,
} from '../../lib/music';
import FocusStatsLauncher from '../focusStats/FocusStatsLauncher';
import ReviewCalendarLauncher from '../review/ReviewCalendarLauncher';
import { fetchChengduWeather } from '../../lib/weather';
import {
  getFocusSessionSummary,
  getPomodoroSettings,
  listScenes,
  listTodos,
  recordFocusSession,
  recordFocusSessionOnUnload,
  updatePomodoroSettings,
  updateTodo,
} from '../../lib/api';

const PHASE_LABELS = {
  [TIMER_PHASES.FOCUS]: '专注时间',
  [TIMER_PHASES.SHORT_BREAK]: '短休息',
  [TIMER_PHASES.LONG_BREAK]: '长休息',
};

const PHASE_COPY = {
  [TIMER_PHASES.FOCUS]: '把注意力留给眼前这一件事。',
  [TIMER_PHASES.SHORT_BREAK]: '放松一下，等会儿继续出发。',
  [TIMER_PHASES.LONG_BREAK]: '这一轮辛苦了，慢慢休息更久一点。',
};

const SETTINGS_FIELDS = [
  { key: 'focusMinutes', label: '专注时长（分钟）' },
  { key: 'shortBreakMinutes', label: '短休息（分钟）' },
  { key: 'longBreakMinutes', label: '长休息（分钟）' },
  { key: 'longBreakInterval', label: '长休息间隔（轮）' },
];

function getBeijingTimeParts(currentDate) {
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
  const timeFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return {
    dateLabel: dateFormatter.format(currentDate),
    timeLabel: timeFormatter.format(currentDate),
  };
}

function getLocalDate(value) {
  return value.toLocaleDateString('en-CA');
}

function formatTodayFocusDuration(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10.86 2.57a1 1 0 0 1 1.28 0l1.12.94a1 1 0 0 0 .96.18l1.4-.46a1 1 0 0 1 1.21.62l.5 1.39a1 1 0 0 0 .72.65l1.44.31a1 1 0 0 1 .76 1.03l-.1 1.46a1 1 0 0 0 .36.91l1.14.92a1 1 0 0 1 .23 1.26l-.72 1.28a1 1 0 0 0 0 .97l.72 1.28a1 1 0 0 1-.23 1.26l-1.14.92a1 1 0 0 0-.36.91l.1 1.46a1 1 0 0 1-.76 1.03l-1.44.31a1 1 0 0 0-.72.65l-.5 1.39a1 1 0 0 1-1.21.62l-1.4-.46a1 1 0 0 0-.96.18l-1.12.94a1 1 0 0 1-1.28 0l-1.12-.94a1 1 0 0 0-.96-.18l-1.4.46a1 1 0 0 1-1.21-.62l-.5-1.39a1 1 0 0 0-.72-.65l-1.44-.31a1 1 0 0 1-.76-1.03l.1-1.46a1 1 0 0 0-.36-.91l-1.14-.92a1 1 0 0 1-.23-1.26l.72-1.28a1 1 0 0 0 0-.97l-.72-1.28a1 1 0 0 1 .23-1.26l1.14-.92a1 1 0 0 0 .36-.91l-.1-1.46a1 1 0 0 1 .76-1.03l1.44-.31a1 1 0 0 0 .72-.65l.5-1.39a1 1 0 0 1 1.21-.62l1.4.46a1 1 0 0 0 .96-.18l1.12-.94Z" />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6.5v11l9-5.5-9-5.5Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 6h3v12H8zM13 6h3v12h-3z" fill="currentColor" />
    </svg>
  );
}

function ResetIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5a7 7 0 1 1-6.93 8h2.08A5 5 0 1 0 12 7c-1.33 0-2.54.52-3.43 1.37L11 10.8H5V4.8l2.14 2.14A6.96 6.96 0 0 1 12 5Z" fill="currentColor" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 7.5v9l6.5-4.5L6 7.5Zm7.5 0v9l6.5-4.5-6.5-4.5Z" fill="currentColor" />
    </svg>
  );
}

function SceneBindIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 3.2 19.6 7.6v8.8L12 20.8l-7.6-4.4V7.6L12 3.2Zm0 2.3L6.4 8.72v6.56L12 18.5l5.6-3.22V8.72L12 5.5Z"
        fill="currentColor"
      />
      <path d="M12 8.2a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z" fill="currentColor" opacity=".42" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15.5 5.5v8.4a3.2 3.2 0 1 1-1.8-2.88V7.22l-6 1.3v6.38a3.2 3.2 0 1 1-1.8-2.88V7.1c0-.86.6-1.6 1.44-1.79l6.56-1.42a1.5 1.5 0 0 1 1.88 1.61Z"
        fill="currentColor"
      />
    </svg>
  );
}

const PomodoroPage = forwardRef(function PomodoroPage({
  immersiveSidebar = null,
  focusTodoRequest = null,
  unbindFocusSignal = 0,
  completeFocusSignal = null,
  sceneRefreshSignal = 0,
  onFocusTimerChange = () => {},
  onFocusTodoCompleted = () => {},
} = {}, ref) {
  const timerCardRef = useRef(null);
  const settingsPanelRef = useRef(null);
  const musicPanelRef = useRef(null);
  const musicButtonRef = useRef(null);
  const focusTaskMenuRef = useRef(null);
  const sceneMenuRef = useRef(null);
  const feedbackTimeoutRef = useRef(null);
  const focusSessionToRecordRef = useRef(null);
  const focusBindingStartRemainingRef = useRef(null);
  const unloadFocusSessionKeyRef = useRef('');
  const [settings, setSettings] = useState(() => createDefaultSettings());
  const [timerState, setTimerState] = useState(() => createInitialTimerState(createDefaultSettings()));
  const [settingsErrorMessage, setSettingsErrorMessage] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSkipChoiceOpen, setIsSkipChoiceOpen] = useState(false);
  const [isMusicPanelOpen, setIsMusicPanelOpen] = useState(false);
  const [musicInputValue, setMusicInputValue] = useState('');
  const [musicTitleValue, setMusicTitleValue] = useState('');
  const [activePlaylist, setActivePlaylist] = useState(null);
  const [savedPlaylists, setSavedPlaylists] = useState([]);
  const [musicErrorMessage, setMusicErrorMessage] = useState('');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [focusTodos, setFocusTodos] = useState([]);
  const [selectedFocusTodoId, setSelectedFocusTodoId] = useState('');
  const [selectedFocusTodoTitle, setSelectedFocusTodoTitle] = useState('');
  const [selectedFocusTodoType, setSelectedFocusTodoType] = useState('');
  const [focusScenes, setFocusScenes] = useState([]);
  const [selectedSceneId, setSelectedSceneId] = useState('');
  const [selectedSceneTitle, setSelectedSceneTitle] = useState('');
  const [isSceneMenuOpen, setIsSceneMenuOpen] = useState(false);
  const [isFocusTaskMenuOpen, setIsFocusTaskMenuOpen] = useState(false);
  const [focusBindingError, setFocusBindingError] = useState('');
  const [todayFocusSeconds, setTodayFocusSeconds] = useState(0);
  const [focusStatsRefreshSignal, setFocusStatsRefreshSignal] = useState(0);
  const [activeFeedbackButton, setActiveFeedbackButton] = useState('');
  const [weatherState, setWeatherState] = useState({
    status: 'loading',
    data: null,
    errorMessage: '',
  });

  function getCurrentFocusSession() {
    if ((!selectedFocusTodoId && !selectedSceneId) || timerState.phase !== TIMER_PHASES.FOCUS) {
      return null;
    }

    const startedAtRemaining = focusBindingStartRemainingRef.current ?? timerState.remainingSeconds;
    const durationSeconds = Math.max(0, startedAtRemaining - timerState.remainingSeconds);
    if (durationSeconds <= 0) {
      return null;
    }

    return {
      todoId: selectedFocusTodoId ? Number(selectedFocusTodoId) : 0,
      sceneId: selectedSceneId ? Number(selectedSceneId) : 0,
      durationSeconds,
      sessionDate: getLocalDate(new Date()),
    };
  }

  function markCurrentFocusSessionRecorded(session, { notifyTodoRefresh = true } = {}) {
    if (session.sessionDate === todayDate) {
      setTodayFocusSeconds((seconds) => seconds + session.durationSeconds);
    }
    focusBindingStartRemainingRef.current = timerState.remainingSeconds;
    setFocusStatsRefreshSignal((signal) => signal + 1);
    if (notifyTodoRefresh && selectedFocusTodoId) {
      onFocusTodoCompleted();
    }
  }

  async function persistCurrentFocusDuration({ notifyTodoRefresh = true } = {}) {
    const session = getCurrentFocusSession();
    if (!session) {
      return;
    }

    await recordFocusSession(session);
    markCurrentFocusSessionRecorded(session, { notifyTodoRefresh });
  }

  useEffect(() => {
    let isDisposed = false;

    const loadSettings = async () => {
      try {
        const savedSettings = await getPomodoroSettings();
        if (isDisposed || !savedSettings) {
          return;
        }

        const nextSettings = {
          ...createDefaultSettings(),
          ...savedSettings,
        };

        setSettings(nextSettings);
        setTimerState((state) => applySettingsToTimerState(state, nextSettings));
        setSettingsErrorMessage('');
      } catch {
        if (!isDisposed) {
          setSettingsErrorMessage('计时设置读取失败，暂时使用默认设置');
        }
      }
    };

    loadSettings();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    if (!timerState.isRunning) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setTimerState((currentState) => {
        const nextState = getNextTimerState(currentState, 'tick', settings);

        if (
          currentState.phase === TIMER_PHASES.FOCUS &&
          currentState.isRunning &&
          currentState.remainingSeconds === 1 &&
          (selectedFocusTodoId || selectedSceneId)
        ) {
          const startedAtRemaining = focusBindingStartRemainingRef.current ?? currentState.totalSeconds;
          focusSessionToRecordRef.current = {
            todoId: selectedFocusTodoId ? Number(selectedFocusTodoId) : 0,
            sceneId: selectedSceneId ? Number(selectedSceneId) : 0,
            durationSeconds: Math.max(1, startedAtRemaining - currentState.remainingSeconds + 1),
            sessionDate: getLocalDate(new Date()),
          };
          focusBindingStartRemainingRef.current = null;
        }

        return nextState;
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [settings, timerState.isRunning, selectedFocusTodoId, selectedSceneId]);

  useEffect(() => {
    const session = focusSessionToRecordRef.current;
    if (!session) {
      return;
    }

    focusSessionToRecordRef.current = null;
    recordFocusSession(session)
      .then(() => {
        if (session.sessionDate === getLocalDate(new Date())) {
          setTodayFocusSeconds((seconds) => seconds + session.durationSeconds);
        }
        setFocusStatsRefreshSignal((signal) => signal + 1);
        onFocusTodoCompleted();
      })
      .catch(() => {
        setFocusBindingError('专注记录保存失败');
      });
  }, [onFocusTodoCompleted, timerState.completedFocusSessions, timerState.phase]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentDate(new Date());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let isDisposed = false;
    listScenes()
      .then((scenes) => {
        if (isDisposed) return;
        setFocusScenes(scenes);
        setSelectedSceneId((currentId) => {
          if (!currentId) return '';
          const matchingScene = scenes.find((scene) => String(scene.id) === currentId);
          if (!matchingScene) {
            setSelectedSceneTitle('');
            return '';
          }
          setSelectedSceneTitle(matchingScene.title);
          return currentId;
        });
      })
      .catch(() => {
        if (isDisposed) return;
        setFocusScenes([]);
      });
    return () => {
      isDisposed = true;
    };
  }, [focusStatsRefreshSignal, sceneRefreshSignal]);

  useEffect(() => {
    let isDisposed = false;

    const loadFocusTodos = async () => {
      try {
        const todos = await listTodos();

        if (isDisposed) {
          return;
        }

        setFocusTodos(todos);
        setFocusBindingError('');
        setSelectedFocusTodoId((currentID) => {
          if (!currentID) {
            return '';
          }

          const matchingTodo = todos.find((todo) => String(todo.id) === currentID);
          if (!matchingTodo) {
            setSelectedFocusTodoTitle('');
            setSelectedFocusTodoType('');
            return '';
          }

          setSelectedFocusTodoTitle(matchingTodo.title);
          setSelectedFocusTodoType(matchingTodo.sourceType ?? '');
          return currentID;
        });
      } catch {
        if (isDisposed) {
          return;
        }

        setFocusTodos([]);
        setSelectedFocusTodoId('');
        setSelectedFocusTodoTitle('');
        setSelectedFocusTodoType('');
        setFocusBindingError('任务列表加载失败');
      }
    };

    loadFocusTodos();

    return () => {
      isDisposed = true;
    };
  }, []);

  useEffect(() => {
    if (!focusTodoRequest?.id) {
      return;
    }

    setSelectedFocusTodoId(String(focusTodoRequest.id));
    setSelectedFocusTodoTitle(focusTodoRequest.title);
    setSelectedFocusTodoType(focusTodoRequest.sourceType ?? '');
    focusBindingStartRemainingRef.current = timerState.phase === TIMER_PHASES.FOCUS
      ? timerState.remainingSeconds
      : null;
    setFocusBindingError('');
    showButtonFeedback('timer-toggle');
    setTimerState((state) => (
      state.phase === TIMER_PHASES.FOCUS && !state.isRunning
        ? getNextTimerState(state, 'start', settings)
        : state
    ));
  }, [focusTodoRequest?.stamp]);

  useEffect(() => {
    if (
      (selectedFocusTodoId || selectedSceneId) &&
      timerState.phase === TIMER_PHASES.FOCUS &&
      focusBindingStartRemainingRef.current == null
    ) {
      focusBindingStartRemainingRef.current = timerState.remainingSeconds;
    }
  }, [selectedFocusTodoId, selectedSceneId, timerState.phase, timerState.remainingSeconds]);

  useEffect(() => {
    if (!unbindFocusSignal) {
      return;
    }

    setSelectedFocusTodoId('');
    setSelectedFocusTodoTitle('');
    setSelectedFocusTodoType('');
    focusBindingStartRemainingRef.current = null;
    setIsFocusTaskMenuOpen(false);
  }, [unbindFocusSignal]);

  useEffect(() => {
    if (!completeFocusSignal?.stamp || String(completeFocusSignal.todoId) !== selectedFocusTodoId) {
      return;
    }

    let isDisposed = false;

    const completeBoundTodo = async () => {
      try {
        await persistCurrentFocusDuration();
        if (isDisposed) {
          return;
        }

        clearFocusTodoBinding();
      } catch (error) {
        if (!isDisposed) {
          setFocusBindingError(error instanceof Error ? error.message : '专注记录保存失败');
        }
      }
    };

    completeBoundTodo();

    return () => {
      isDisposed = true;
    };
  }, [completeFocusSignal?.stamp]);

  useEffect(() => {
    onFocusTimerChange(selectedFocusTodoId ? {
      todoId: Number(selectedFocusTodoId),
      title: selectedFocusTodoTitle,
      phase: timerState.phase,
      isRunning: timerState.isRunning,
      remainingSeconds: timerState.remainingSeconds,
    } : null);
  }, [
    onFocusTimerChange,
    selectedFocusTodoId,
    selectedFocusTodoTitle,
    timerState.phase,
    timerState.isRunning,
    timerState.remainingSeconds,
  ]);

  useEffect(() => {
    let isDisposed = false;

    const loadWeather = async () => {
      try {
        const weather = await fetchChengduWeather();

        if (isDisposed) {
          return;
        }

        setWeatherState({
          status: 'success',
          data: weather,
          errorMessage: '',
        });
      } catch (error) {
        if (isDisposed) {
          return;
        }

        setWeatherState({
          status: 'error',
          data: null,
          errorMessage: error instanceof Error ? error.message : '天气加载失败',
        });
      }
    };

    loadWeather();
    const intervalId = window.setInterval(loadWeather, 10 * 60_000);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    try {
      const rawValue = window.localStorage.getItem(MUSIC_STORAGE_KEY);
      if (!rawValue) {
        return;
      }

      const parsedValue = JSON.parse(rawValue);
      if (Array.isArray(parsedValue)) {
        setSavedPlaylists(parsedValue);
      }
    } catch {
      window.localStorage.removeItem(MUSIC_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(savedPlaylists));
  }, [savedPlaylists]);

  useEffect(() => () => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  const currentPhaseLabel = PHASE_LABELS[timerState.phase];
  const sceneStatusLabel = selectedSceneTitle || '绑定场景';
  const selectedScene = selectedSceneId
    ? focusScenes.find((scene) => String(scene.id) === selectedSceneId)
    : null;
  const currentRound = (timerState.completedFocusSessions % settings.longBreakInterval) + 1;
  const { dateLabel, timeLabel } = getBeijingTimeParts(currentDate);
  const todayDate = getLocalDate(currentDate);
  const todayFocusLabel = `今日专注 ${formatTodayFocusDuration(todayFocusSeconds)}`;
  const focusCopy =
    timerState.phase === TIMER_PHASES.FOCUS && selectedFocusTodoTitle
      ? `把注意力留给${selectedFocusTodoTitle}`
      : PHASE_COPY[timerState.phase];
  const isBreakPhase = timerState.phase !== TIMER_PHASES.FOCUS;
  const nextPhaseLabel =
    currentRound === settings.longBreakInterval ? PHASE_LABELS[TIMER_PHASES.LONG_BREAK] : PHASE_LABELS[TIMER_PHASES.SHORT_BREAK];
  const weatherSummary =
    weatherState.status === 'success'
      ? `${weatherState.data.weatherLabel} ${weatherState.data.temperature}°C`
      : weatherState.status === 'error'
        ? '天气暂时不可用'
        : '天气加载中...';

  useImperativeHandle(ref, () => ({
    flushCurrentFocusDuration: () => persistCurrentFocusDuration({ notifyTodoRefresh: false }),
  }));

  useEffect(() => {
    const persistFocusOnPageExit = () => {
      const session = getCurrentFocusSession();
      if (!session) {
        return;
      }

      const sessionKey = [
        session.todoId,
        session.sceneId,
        session.durationSeconds,
        session.sessionDate,
        timerState.remainingSeconds,
      ].join(':');
      if (unloadFocusSessionKeyRef.current === sessionKey) {
        return;
      }

      if (recordFocusSessionOnUnload(session)) {
        unloadFocusSessionKeyRef.current = sessionKey;
        focusBindingStartRemainingRef.current = timerState.remainingSeconds;
      }
    };

    window.addEventListener('pagehide', persistFocusOnPageExit);
    window.addEventListener('beforeunload', persistFocusOnPageExit);

    return () => {
      window.removeEventListener('pagehide', persistFocusOnPageExit);
      window.removeEventListener('beforeunload', persistFocusOnPageExit);
    };
  }, [
    selectedFocusTodoId,
    selectedSceneId,
    timerState.phase,
    timerState.remainingSeconds,
  ]);

  useEffect(() => {
    let isDisposed = false;

    getFocusSessionSummary(todayDate)
      .then((summary) => {
        if (isDisposed) {
          return;
        }

        setTodayFocusSeconds(summary?.durationSeconds ?? 0);
      })
      .catch(() => {
        if (!isDisposed) {
          setTodayFocusSeconds(0);
        }
      });

    return () => {
      isDisposed = true;
    };
  }, [todayDate]);

  const showButtonFeedback = (buttonKey) => {
    if (feedbackTimeoutRef.current) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }

    setActiveFeedbackButton(buttonKey);
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setActiveFeedbackButton('');
      feedbackTimeoutRef.current = null;
    }, 260);
  };

  const getFeedbackClassName = (buttonKey) => (
    activeFeedbackButton === buttonKey ? 'is-click-confirmed' : ''
  );

  const handleTimerAction = async (action) => {
    if (action === 'pause' && timerState.phase === TIMER_PHASES.FOCUS && timerState.isRunning) {
      try {
        await persistCurrentFocusDuration({ notifyTodoRefresh: false });
      } catch (error) {
        setFocusBindingError(error instanceof Error ? error.message : '专注记录保存失败');
      }
    }
    setTimerState((state) => getNextTimerState(state, action, settings));
  };

  const handleFocusSkipChoice = (action) => {
    handleTimerAction(action);
    setIsSkipChoiceOpen(false);
  };

  const clearFocusTodoBinding = () => {
    setSelectedFocusTodoId('');
    setSelectedFocusTodoTitle('');
    setSelectedFocusTodoType('');
    focusBindingStartRemainingRef.current = null;
    setIsFocusTaskMenuOpen(false);
    setFocusBindingError('');
  };

  const handleClearSceneBinding = async () => {
    try {
      await persistCurrentFocusDuration({ notifyTodoRefresh: false });
      setSelectedSceneId('');
      setSelectedSceneTitle('');
      setIsSceneMenuOpen(false);
      focusBindingStartRemainingRef.current = timerState.phase === TIMER_PHASES.FOCUS ? timerState.remainingSeconds : null;
    } catch (error) {
      setFocusBindingError(error instanceof Error ? error.message : '专注记录保存失败');
    }
  };

  const handleClearFocusTodoBinding = async () => {
    try {
      await persistCurrentFocusDuration();
      clearFocusTodoBinding();
    } catch (error) {
      setFocusBindingError(error instanceof Error ? error.message : '专注记录保存失败');
    }
  };

  const handleCompleteFocusTodo = async () => {
    if (!selectedFocusTodoId) {
      return;
    }

    try {
      await persistCurrentFocusDuration();
      await updateTodo(Number(selectedFocusTodoId), { completed: true });
      clearFocusTodoBinding();
      onFocusTodoCompleted();
    } catch (error) {
      setFocusBindingError(error instanceof Error ? error.message : '任务完成状态更新失败');
    }
  };

  const handleNumberSettingChange = (key, value) => {
    const parsedValue = Number.parseInt(value, 10);

    if (Number.isNaN(parsedValue)) {
      return;
    }

    const nextSettings = {
      ...settings,
      [key]: Math.max(1, parsedValue),
    };

    setSettings(nextSettings);
    setTimerState((state) => applySettingsToTimerState(state, nextSettings));
    updatePomodoroSettings(nextSettings)
      .then((savedSettings) => {
        setSettings({
          ...createDefaultSettings(),
          ...savedSettings,
        });
        setSettingsErrorMessage('');
      })
      .catch(() => {
        setSettingsErrorMessage('计时设置保存失败，请稍后再试');
      });
  };

  const handleAutoStartChange = () => {
    const nextSettings = {
      ...settings,
      autoStartNextSession: !settings.autoStartNextSession,
    };

    setSettings(nextSettings);
    updatePomodoroSettings(nextSettings)
      .then((savedSettings) => {
        setSettings({
          ...createDefaultSettings(),
          ...savedSettings,
        });
        setSettingsErrorMessage('');
      })
      .catch(() => {
        setSettingsErrorMessage('计时设置保存失败，请稍后再试');
      });
  };

  const handleMusicLoad = () => {
    const playlistId = parseNeteasePlaylistInput(musicInputValue);

    if (!playlistId) {
      setMusicErrorMessage('暂时无法识别这个网易云歌单链接或 ID。');
      return;
    }

    setActivePlaylist(createSavedPlaylistRecord({
      id: playlistId,
      title: musicTitleValue,
      sourceUrl: musicInputValue.trim(),
    }));
    setMusicErrorMessage('');
  };

  const handleSaveActivePlaylist = () => {
    if (!activePlaylist) {
      return;
    }

    setSavedPlaylists((currentPlaylists) => {
      const nextPlaylists = [
        activePlaylist,
        ...currentPlaylists.filter((playlist) => playlist.id !== activePlaylist.id),
      ];

      return nextPlaylists.slice(0, 5);
    });
  };

  const handleLoadSavedPlaylist = (playlist) => {
    setActivePlaylist(playlist);
    setMusicErrorMessage('');
  };

  const handleRemoveSavedPlaylist = (playlistId) => {
    setSavedPlaylists((currentPlaylists) => currentPlaylists.filter((playlist) => playlist.id !== playlistId));
  };

  const renderSettingsPanel = () =>
    isSettingsOpen ? (
      <div className="settings-panel settings-panel-immersive" role="dialog" aria-label="计时设置">
        <div ref={settingsPanelRef}>
          <div className="settings-panel-header">
            <p>计时设置</p>
            <span>轻轻调整你的节奏</span>
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
                  onChange={(event) => handleNumberSettingChange(field.key, event.target.value)}
                />
              </label>
            ))}
          </div>

          <label className="toggle-row">
            <span>自动开始下一阶段</span>
            <input
              type="checkbox"
              checked={settings.autoStartNextSession}
              onChange={handleAutoStartChange}
            />
          </label>

          {settingsErrorMessage ? (
            <p className="settings-error" role="alert">{settingsErrorMessage}</p>
          ) : null}
        </div>
      </div>
    ) : null;

  const renderSkipChoicePanel = () =>
    isSkipChoiceOpen ? (
      <div
        className="skip-choice-panel skip-choice-panel-immersive"
        role="dialog"
        aria-label="跳过专注选择"
      >
        <p className="skip-choice-title">这次专注要怎么处理？</p>
        <div className="skip-choice-actions">
          <button
            type="button"
            className="primary-button compact-button"
            onClick={() => handleFocusSkipChoice('skipFocusCompleted')}
          >
            算完成，进入休息
          </button>
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={() => handleFocusSkipChoice('skipFocusIncomplete')}
          >
            不算完成，直接休息
          </button>
          <button
            type="button"
            className="ghost-button compact-button"
            onClick={() => setIsSkipChoiceOpen(false)}
          >
            取消
          </button>
        </div>
      </div>
    ) : null;

  const renderFocusBindingError = () => (
    focusBindingError ? <p className="focus-binding-error" role="alert">{focusBindingError}</p> : null
  );

  const renderSceneButton = (className) => (
    <span className="focus-task-menu-wrap" ref={sceneMenuRef}>
      <button
        type="button"
        className={`${className} task-pill-button has-tooltip ${selectedScene ? 'has-scene' : ''}`}
        aria-label="绑定场景"
        data-tooltip={sceneStatusLabel}
        title={sceneStatusLabel}
        aria-haspopup="menu"
        aria-expanded={isSceneMenuOpen}
        style={selectedScene ? { '--scene-color': selectedScene.color || '#4b8768' } : undefined}
        onClick={() => setIsSceneMenuOpen((open) => !open)}
      >
        <SceneBindIcon />
        {selectedScene ? <span className="scene-control-dot" aria-hidden="true" /> : null}
      </button>
      {isSceneMenuOpen ? (
        <div className="focus-task-menu" role="menu" aria-label="选择专注场景">
          <button
            type="button"
            role="menuitem"
            onClick={handleClearSceneBinding}
          >
            不绑定场景
          </button>
          {focusScenes.map((scene) => (
            <button
              type="button"
              role="menuitem"
              key={scene.id}
              className="focus-scene-menu-item"
              onClick={() => {
                setSelectedSceneId(String(scene.id));
                setSelectedSceneTitle(scene.title);
                setIsSceneMenuOpen(false);
                focusBindingStartRemainingRef.current = timerState.phase === TIMER_PHASES.FOCUS ? timerState.remainingSeconds : null;
              }}
            >
              <span className="scene-color-dot" style={{ '--scene-color': scene.color || '#4b8768' }} aria-hidden="true" />
              {scene.title}
            </button>
          ))}
          {focusScenes.length === 0 ? <span className="focus-task-menu-empty">还没有场景</span> : null}
        </div>
      ) : null}
    </span>
  );

  const renderTimerControls = (className = 'controls') => (
    <div className={className}>
      {renderSceneButton('ghost-button scene-control-button')}
      <button
        type="button"
        className={`primary-button timer-action-button has-tooltip ${getFeedbackClassName('timer-toggle')}`}
        aria-label={timerState.isRunning ? '暂停' : '开始'}
        data-tooltip={timerState.isRunning ? '暂停' : '开始'}
        onClick={() => {
          showButtonFeedback('timer-toggle');
          handleTimerAction(timerState.isRunning ? 'pause' : 'start');
        }}
      >
        {timerState.isRunning ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button
        type="button"
        className={`ghost-button timer-action-button has-tooltip ${getFeedbackClassName('reset')}`}
        aria-label="重置"
        data-tooltip="重置"
        onClick={() => {
          showButtonFeedback('reset');
          handleTimerAction('reset');
        }}
      >
        <ResetIcon />
      </button>
      {isBreakPhase ? (
        <button
          type="button"
          className={`ghost-button timer-action-button has-tooltip ${getFeedbackClassName('skip-break')}`}
          aria-label="跳过休息"
          data-tooltip="跳过休息"
          onClick={() => {
            showButtonFeedback('skip-break');
            handleTimerAction('skipBreak');
          }}
        >
          <SkipIcon />
        </button>
      ) : (
        <button
          type="button"
          className={`ghost-button timer-action-button has-tooltip ${getFeedbackClassName('skip-focus')}`}
          aria-label="跳过"
          data-tooltip="跳过"
          onClick={() => {
            showButtonFeedback('skip-focus');
            setIsSettingsOpen(false);
            setIsSkipChoiceOpen(true);
          }}
        >
          <SkipIcon />
        </button>
      )}
    </div>
  );

  const renderTimerMeta = (className = 'timer-meta-strip') => (
    <div className={className}>
      <div>
        <span className="meta-label">Cycle</span>
        <strong>{currentRound} / {settings.longBreakInterval}</strong>
      </div>
      <div>
        <span className="meta-label">Next</span>
        <strong>{nextPhaseLabel}</strong>
      </div>
    </div>
  );

  const renderImmersiveAmbientStrip = () => (
    <div className="immersive-ambient-strip" aria-label="时间、城市与天气">
      <div className="immersive-ambient-pill">
        <span className="immersive-ambient-label">Time</span>
        <strong>{timeLabel}</strong>
        <span className="immersive-ambient-meta">{dateLabel}</span>
      </div>
      <div className="immersive-ambient-pill">
        <span className="immersive-ambient-label">Location</span>
        <strong>Chengdu, CN</strong>
        <span className="immersive-ambient-meta">云端专注当下所在</span>
      </div>
      <div className="immersive-ambient-pill" aria-live="polite">
        <span className="immersive-ambient-label">Weather</span>
        <strong>{weatherSummary}</strong>
        <span className="immersive-ambient-meta">
          {weatherState.status === 'success'
            ? `体感 ${weatherState.data.apparentTemperature}°C`
            : weatherState.status === 'error'
              ? weatherState.errorMessage
              : '实时同步中'}
        </span>
      </div>
    </div>
  );

  const renderBrandMark = () => (
    <div className="brand-mark">
      <span className="brand-dot" />
      <div>
        <p className="brand-kicker">Aesthetic Focus Timer</p>
        <p className="brand-name">Focus Tomato</p>
      </div>
    </div>
  );

  const renderMusicPanel = () =>
    isMusicPanelOpen ? (
      <section ref={musicPanelRef} className="music-panel" role="dialog" aria-label="网易云音乐">
        <div className="music-panel-header">
          <p className="music-panel-title">网易云音乐</p>
          <p className="music-panel-subtitle">加载公开歌单，边专注边播放</p>
        </div>

        <div className="music-form">
          <label className="music-field">
            <span>网易云歌单链接或 ID</span>
            <input
              type="text"
              value={musicInputValue}
              onChange={(event) => setMusicInputValue(event.target.value)}
              placeholder="例如 https://music.163.com/#/playlist?id=3778678"
            />
          </label>
          <label className="music-field">
            <span>歌单名称（可选）</span>
            <input
              type="text"
              value={musicTitleValue}
              onChange={(event) => setMusicTitleValue(event.target.value)}
              placeholder="给这张歌单起个专注别名"
            />
          </label>
        </div>

        <div className="music-actions">
          <button type="button" className="primary-button music-action-button" onClick={handleMusicLoad}>
            加载歌单
          </button>
          <button type="button" className="ghost-button music-action-button" onClick={handleSaveActivePlaylist}>
            保存到收藏
          </button>
        </div>

        {musicErrorMessage ? <p className="music-error" role="alert">{musicErrorMessage}</p> : null}

        {savedPlaylists.length > 0 ? (
          <div className="music-favorites">
            <p className="music-section-title">常用歌单</p>
            <div className="music-favorites-list">
              {savedPlaylists.map((playlist) => (
                <div key={playlist.id} className="music-favorite-item">
                  <button
                    type="button"
                    className="ghost-button music-favorite-load"
                    aria-label={`加载收藏歌单 ${playlist.title}`}
                    onClick={() => handleLoadSavedPlaylist(playlist)}
                  >
                    {playlist.title}
                  </button>
                  <button
                    type="button"
                    className="music-favorite-remove"
                    aria-label={`删除收藏歌单 ${playlist.title}`}
                    onClick={() => handleRemoveSavedPlaylist(playlist.id)}
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="music-player-shell">
          {activePlaylist ? (
            <iframe
              title="网易云歌单播放器"
              src={activePlaylist.embedUrl}
              className="music-player-frame"
              allow="encrypted-media"
            />
          ) : (
            <p className="music-placeholder">粘贴公开歌单链接后，这里会显示网易云官方播放器。</p>
          )}
        </div>

        <p className="music-footnote">
          部分歌曲可能因会员、版权或外链限制无法播放，请以网易云官方播放器实际可播状态为准。
        </p>
      </section>
    ) : null;

  const renderImmersivePanel = () => (
    <section ref={timerCardRef} className="immersive-panel" aria-label="沉浸专注">
      {renderImmersiveAmbientStrip()}

      <div className="immersive-phase-group">
        <span className="immersive-phase-pill" title="今日累计专注时长">{todayFocusLabel}</span>
      </div>
      {renderSkipChoicePanel()}

      <div className="immersive-time-wrap">
        <p className="phase-title immersive-phase-title">{currentPhaseLabel}</p>
        <div className="immersive-time">{formatTime(timerState.remainingSeconds)}</div>
        <p className="immersive-copy">{focusCopy}</p>
      </div>

      {renderFocusBindingError()}
      {renderTimerControls('controls immersive-controls')}
      {renderTimerMeta('timer-meta-strip immersive-meta')}
    </section>
  );

  const handlePagePointerDown = (event) => {
    if (!isSettingsOpen && !isSkipChoiceOpen && !isMusicPanelOpen && !isFocusTaskMenuOpen && !isSceneMenuOpen) {
      return;
    }

    if (isSceneMenuOpen && sceneMenuRef.current?.contains(event.target)) {
      return;
    }

    if (isSceneMenuOpen) {
      setIsSceneMenuOpen(false);
    }

    if (isFocusTaskMenuOpen && focusTaskMenuRef.current?.contains(event.target)) {
      return;
    }

    if (isFocusTaskMenuOpen) {
      setIsFocusTaskMenuOpen(false);
    }

    if (isSettingsOpen || isSkipChoiceOpen || isFocusTaskMenuOpen) {
      if (timerCardRef.current?.contains(event.target)) {
        return;
      }

      if (settingsPanelRef.current?.contains(event.target)) {
        return;
      }
    }

    if (isMusicPanelOpen) {
      if (musicPanelRef.current?.contains(event.target)) {
        return;
      }

      if (musicButtonRef.current?.contains(event.target)) {
        return;
      }
    }

    if (isSettingsOpen || isSkipChoiceOpen) {
      setIsSettingsOpen(false);
      setIsSkipChoiceOpen(false);
    }

    if (isMusicPanelOpen) {
      setIsMusicPanelOpen(false);
    }
  };

  return (
    <main className="page-shell page-shell-immersive" onMouseDown={handlePagePointerDown}>
      <div className="scene-backdrop" aria-hidden="true">
        <div className="scene-sun" />
        <div className="scene-glow scene-glow-left" />
        <div className="scene-glow scene-glow-right" />
        <div className="scene-cloud scene-cloud-one" />
        <div className="scene-cloud scene-cloud-two" />
        <div className="scene-haze" />
      </div>

      <header className="page-header page-header-immersive" role="banner">
        <div className="page-header-left page-header-left-immersive">
          {renderBrandMark()}
        </div>
      </header>

      <section className="focus-stage focus-stage-immersive">
        {immersiveSidebar ? (
          <div className="immersive-workspace">
            {immersiveSidebar}
            {renderImmersivePanel()}
          </div>
        ) : renderImmersivePanel()}
      </section>

      {renderSettingsPanel()}
      {renderMusicPanel()}

      <div className="music-launcher">
        <button
          ref={musicButtonRef}
          type="button"
          className={`music-launcher-button has-tooltip ${isMusicPanelOpen ? 'active' : ''} ${getFeedbackClassName('music')}`}
          aria-label="打开音乐面板"
          aria-pressed={isMusicPanelOpen}
          data-tooltip="打开音乐面板"
          onClick={() => {
            showButtonFeedback('music');
            setMusicErrorMessage('');
            setIsMusicPanelOpen((open) => !open);
          }}
        >
          <MusicIcon />
        </button>
      </div>

      <div className="settings-launcher">
        <ReviewCalendarLauncher refreshSignal={focusStatsRefreshSignal} />
        <FocusStatsLauncher refreshSignal={focusStatsRefreshSignal} />
        <button
          type="button"
          className={`mode-switch-button has-tooltip ${isSettingsOpen ? 'active' : ''} ${getFeedbackClassName('settings')}`}
          aria-label="打开设置"
          aria-pressed={isSettingsOpen}
          data-tooltip="打开设置"
          onClick={() => {
            showButtonFeedback('settings');
            setIsSkipChoiceOpen(false);
            setIsSettingsOpen((open) => !open);
          }}
        >
          <SettingsIcon />
        </button>
      </div>
    </main>
  );
});

export default PomodoroPage;
