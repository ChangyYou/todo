export const TIMER_PHASES = {
  FOCUS: 'focus',
  SHORT_BREAK: 'shortBreak',
  LONG_BREAK: 'longBreak',
};

export function createDefaultSettings() {
  return {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakInterval: 4,
    autoStartNextSession: true,
  };
}

export function getPhaseDurationSeconds(phase, settings) {
  if (phase === TIMER_PHASES.SHORT_BREAK) {
    return settings.shortBreakMinutes * 60;
  }

  if (phase === TIMER_PHASES.LONG_BREAK) {
    return settings.longBreakMinutes * 60;
  }

  return settings.focusMinutes * 60;
}

export function createInitialTimerState(settings = createDefaultSettings()) {
  const totalSeconds = getPhaseDurationSeconds(TIMER_PHASES.FOCUS, settings);

  return {
    phase: TIMER_PHASES.FOCUS,
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning: false,
    completedFocusSessions: 0,
  };
}

export function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function createPhaseState(phase, settings, completedFocusSessions, isRunning) {
  const totalSeconds = getPhaseDurationSeconds(phase, settings);

  return {
    phase,
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning,
    completedFocusSessions,
  };
}

function getNextPhaseAfterFocus(completedFocusSessions, settings) {
  if (completedFocusSessions % settings.longBreakInterval === 0) {
    return TIMER_PHASES.LONG_BREAK;
  }

  return TIMER_PHASES.SHORT_BREAK;
}

function createBreakStateAfterFocus(completedFocusSessions, settings) {
  const nextPhase = getNextPhaseAfterFocus(completedFocusSessions, settings);

  return createPhaseState(
    nextPhase,
    settings,
    completedFocusSessions,
    settings.autoStartNextSession,
  );
}

export function getNextTimerState(state, action, settings = createDefaultSettings()) {
  if (action === 'start') {
    return {
      ...state,
      isRunning: true,
    };
  }

  if (action === 'pause') {
    return {
      ...state,
      isRunning: false,
    };
  }

  if (action === 'reset') {
    return createPhaseState(
      state.phase,
      settings,
      state.completedFocusSessions,
      false,
    );
  }

  if (action === 'endFocus') {
    if (state.phase !== TIMER_PHASES.FOCUS) {
      return state;
    }

    return createPhaseState(
      TIMER_PHASES.FOCUS,
      settings,
      state.completedFocusSessions,
      false,
    );
  }

  if (action === 'skipBreak') {
    if (state.phase === TIMER_PHASES.FOCUS) {
      return state;
    }

    return createPhaseState(
      TIMER_PHASES.FOCUS,
      settings,
      state.completedFocusSessions,
      settings.autoStartNextSession,
    );
  }

  if (action === 'skipFocusCompleted') {
    if (state.phase !== TIMER_PHASES.FOCUS) {
      return state;
    }

    return createBreakStateAfterFocus(state.completedFocusSessions + 1, settings);
  }

  if (action === 'skipFocusIncomplete') {
    if (state.phase !== TIMER_PHASES.FOCUS) {
      return state;
    }

    return createPhaseState(
      TIMER_PHASES.SHORT_BREAK,
      settings,
      state.completedFocusSessions,
      settings.autoStartNextSession,
    );
  }

  if (action === 'tick') {
    if (!state.isRunning || state.remainingSeconds === 0) {
      return state;
    }

    if (state.remainingSeconds > 1) {
      return {
        ...state,
        remainingSeconds: state.remainingSeconds - 1,
      };
    }

    if (state.phase === TIMER_PHASES.FOCUS) {
      return createBreakStateAfterFocus(state.completedFocusSessions + 1, settings);
    }

    return createPhaseState(
      TIMER_PHASES.FOCUS,
      settings,
      state.completedFocusSessions,
      settings.autoStartNextSession,
    );
  }

  return state;
}

export function applySettingsToTimerState(state, settings) {
  const totalSeconds = getPhaseDurationSeconds(state.phase, settings);

  if (totalSeconds === state.totalSeconds) {
    return state;
  }

  return {
    ...state,
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning: false,
  };
}

export function getProgressValue(state) {
  if (state.totalSeconds === 0) {
    return 0;
  }

  return (state.totalSeconds - state.remainingSeconds) / state.totalSeconds;
}
