import { describe, expect, it } from 'vitest';
import {
  applySettingsToTimerState,
  createDefaultSettings,
  createInitialTimerState,
  formatTime,
  getNextTimerState,
  getProgressValue,
  TIMER_PHASES,
} from './pomodoro';

describe('createDefaultSettings', () => {
  it('returns the default focus and break durations', () => {
    expect(createDefaultSettings()).toEqual({
      focusMinutes: 25,
      shortBreakMinutes: 5,
      longBreakMinutes: 15,
      longBreakInterval: 4,
      autoStartNextSession: true,
    });
  });
});

describe('formatTime', () => {
  it('formats 25 minutes as 25:00', () => {
    expect(formatTime(1500)).toBe('25:00');
  });

  it('pads single digit seconds', () => {
    expect(formatTime(65)).toBe('01:05');
  });
});

describe('getNextTimerState', () => {
  it('starts the timer without changing the remaining seconds immediately', () => {
    const settings = createDefaultSettings();
    const state = createInitialTimerState(settings);

    expect(getNextTimerState(state, 'start', settings)).toEqual({
      ...state,
      isRunning: true,
    });
  });

  it('decrements by one second on tick when running', () => {
    const settings = createDefaultSettings();
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1500,
      isRunning: true,
      completedFocusSessions: 0,
    };

    expect(getNextTimerState(state, 'tick', settings)).toEqual({
      ...state,
      remainingSeconds: 1499,
    });
  });

  it('pauses without resetting progress', () => {
    const settings = createDefaultSettings();
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1200,
      isRunning: true,
      completedFocusSessions: 0,
    };

    expect(getNextTimerState(state, 'pause', settings)).toEqual({
      ...state,
      isRunning: false,
    });
  });

  it('resets the current phase without losing the completed focus count', () => {
    const settings = createDefaultSettings();
    const state = {
      phase: TIMER_PHASES.SHORT_BREAK,
      totalSeconds: 300,
      remainingSeconds: 120,
      isRunning: true,
      completedFocusSessions: 1,
    };

    expect(getNextTimerState(state, 'reset', settings)).toEqual({
      phase: TIMER_PHASES.SHORT_BREAK,
      totalSeconds: 300,
      remainingSeconds: 300,
      isRunning: false,
      completedFocusSessions: 1,
    });
  });

  it('ends focus without increasing the completed count or entering break', () => {
    const settings = createDefaultSettings();
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 900,
      isRunning: true,
      completedFocusSessions: 2,
    };

    expect(getNextTimerState(state, 'endFocus', settings)).toEqual({
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1500,
      isRunning: false,
      completedFocusSessions: 2,
    });
  });

  it('moves from focus into short break automatically by default', () => {
    const settings = createDefaultSettings();
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1,
      isRunning: true,
      completedFocusSessions: 0,
    };

    expect(getNextTimerState(state, 'tick', settings)).toEqual({
      phase: TIMER_PHASES.SHORT_BREAK,
      totalSeconds: 300,
      remainingSeconds: 300,
      isRunning: true,
      completedFocusSessions: 1,
    });
  });

  it('moves into long break when the focus interval threshold is reached', () => {
    const settings = {
      ...createDefaultSettings(),
      longBreakInterval: 2,
    };
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1,
      isRunning: true,
      completedFocusSessions: 1,
    };

    expect(getNextTimerState(state, 'tick', settings)).toEqual({
      phase: TIMER_PHASES.LONG_BREAK,
      totalSeconds: 900,
      remainingSeconds: 900,
      isRunning: true,
      completedFocusSessions: 2,
    });
  });

  it('returns to focus after a break and respects the auto-start setting', () => {
    const settings = {
      ...createDefaultSettings(),
      autoStartNextSession: false,
    };
    const state = {
      phase: TIMER_PHASES.SHORT_BREAK,
      totalSeconds: 300,
      remainingSeconds: 1,
      isRunning: true,
      completedFocusSessions: 1,
    };

    expect(getNextTimerState(state, 'tick', settings)).toEqual({
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1500,
      isRunning: false,
      completedFocusSessions: 1,
    });
  });

  it('skips a break and returns to focus using the auto-start setting', () => {
    const settings = {
      ...createDefaultSettings(),
      autoStartNextSession: false,
    };
    const state = {
      phase: TIMER_PHASES.LONG_BREAK,
      totalSeconds: 900,
      remainingSeconds: 720,
      isRunning: true,
      completedFocusSessions: 4,
    };

    expect(getNextTimerState(state, 'skipBreak', settings)).toEqual({
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1500,
      isRunning: false,
      completedFocusSessions: 4,
    });
  });

  it('skips focus as completed and moves into the next break', () => {
    const settings = createDefaultSettings();
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 900,
      isRunning: true,
      completedFocusSessions: 0,
    };

    expect(getNextTimerState(state, 'skipFocusCompleted', settings)).toEqual({
      phase: TIMER_PHASES.SHORT_BREAK,
      totalSeconds: 300,
      remainingSeconds: 300,
      isRunning: true,
      completedFocusSessions: 1,
    });
  });

  it('skips focus without completion and enters break without increasing the completed count', () => {
    const settings = {
      ...createDefaultSettings(),
      autoStartNextSession: false,
    };
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 900,
      isRunning: true,
      completedFocusSessions: 2,
    };

    expect(getNextTimerState(state, 'skipFocusIncomplete', settings)).toEqual({
      phase: TIMER_PHASES.SHORT_BREAK,
      totalSeconds: 300,
      remainingSeconds: 300,
      isRunning: false,
      completedFocusSessions: 2,
    });
  });
});

describe('applySettingsToTimerState', () => {
  it('updates the current phase duration when the relevant setting changes', () => {
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1400,
      isRunning: true,
      completedFocusSessions: 0,
    };

    expect(
      applySettingsToTimerState(state, {
        ...createDefaultSettings(),
        focusMinutes: 30,
      }),
    ).toEqual({
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1800,
      remainingSeconds: 1800,
      isRunning: false,
      completedFocusSessions: 0,
    });
  });

  it('keeps the timer untouched when only auto-start changes', () => {
    const state = {
      phase: TIMER_PHASES.FOCUS,
      totalSeconds: 1500,
      remainingSeconds: 1200,
      isRunning: false,
      completedFocusSessions: 2,
    };

    expect(
      applySettingsToTimerState(state, {
        ...createDefaultSettings(),
        autoStartNextSession: false,
      }),
    ).toEqual(state);
  });
});

describe('getProgressValue', () => {
  it('returns a 0 to 1 progress ratio based on elapsed time', () => {
    expect(
      getProgressValue({
        phase: TIMER_PHASES.FOCUS,
        totalSeconds: 1500,
        remainingSeconds: 750,
        isRunning: false,
        completedFocusSessions: 0,
      }),
    ).toBe(0.5);
  });
});
