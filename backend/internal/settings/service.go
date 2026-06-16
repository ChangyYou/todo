package settings

import (
	"database/sql"
	"errors"

	"todo/backend/internal/models"
)

var ErrInvalidPomodoroSettings = errors.New("invalid pomodoro settings")

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func DefaultPomodoroSettings() models.PomodoroSettings {
	return models.PomodoroSettings{
		FocusMinutes:         25,
		ShortBreakMinutes:    5,
		LongBreakMinutes:     15,
		LongBreakInterval:    4,
		AutoStartNextSession: true,
	}
}

func (s *Service) GetPomodoro(userID int64) (models.PomodoroSettings, error) {
	if userID <= 0 {
		return models.PomodoroSettings{}, ErrInvalidPomodoroSettings
	}

	defaults := DefaultPomodoroSettings()
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO pomodoro_settings
			(user_id, focus_minutes, short_break_minutes, long_break_minutes, long_break_interval, auto_start_next_session)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		userID,
		defaults.FocusMinutes,
		defaults.ShortBreakMinutes,
		defaults.LongBreakMinutes,
		defaults.LongBreakInterval,
		boolToInt(defaults.AutoStartNextSession),
	)
	if err != nil {
		return models.PomodoroSettings{}, err
	}

	return s.getPomodoro(userID)
}

func (s *Service) UpdatePomodoro(userID int64, next models.PomodoroSettings) (models.PomodoroSettings, error) {
	if userID <= 0 || !isValidPomodoroSettings(next) {
		return models.PomodoroSettings{}, ErrInvalidPomodoroSettings
	}

	_, err := s.db.Exec(
		`INSERT INTO pomodoro_settings
			(user_id, focus_minutes, short_break_minutes, long_break_minutes, long_break_interval, auto_start_next_session, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
		 ON CONFLICT(user_id) DO UPDATE SET
			focus_minutes = excluded.focus_minutes,
			short_break_minutes = excluded.short_break_minutes,
			long_break_minutes = excluded.long_break_minutes,
			long_break_interval = excluded.long_break_interval,
			auto_start_next_session = excluded.auto_start_next_session,
			updated_at = CURRENT_TIMESTAMP`,
		userID,
		next.FocusMinutes,
		next.ShortBreakMinutes,
		next.LongBreakMinutes,
		next.LongBreakInterval,
		boolToInt(next.AutoStartNextSession),
	)
	if err != nil {
		return models.PomodoroSettings{}, err
	}

	return s.getPomodoro(userID)
}

func (s *Service) getPomodoro(userID int64) (models.PomodoroSettings, error) {
	var result models.PomodoroSettings
	var autoStart int

	err := s.db.QueryRow(
		`SELECT focus_minutes, short_break_minutes, long_break_minutes, long_break_interval, auto_start_next_session, updated_at
		   FROM pomodoro_settings
		  WHERE user_id = ?`,
		userID,
	).Scan(
		&result.FocusMinutes,
		&result.ShortBreakMinutes,
		&result.LongBreakMinutes,
		&result.LongBreakInterval,
		&autoStart,
		&result.UpdatedAt,
	)
	if err != nil {
		return models.PomodoroSettings{}, err
	}

	result.AutoStartNextSession = autoStart == 1
	return result, nil
}

func isValidPomodoroSettings(settings models.PomodoroSettings) bool {
	return settings.FocusMinutes >= 1 &&
		settings.FocusMinutes <= 180 &&
		settings.ShortBreakMinutes >= 1 &&
		settings.ShortBreakMinutes <= 60 &&
		settings.LongBreakMinutes >= 1 &&
		settings.LongBreakMinutes <= 120 &&
		settings.LongBreakInterval >= 1 &&
		settings.LongBreakInterval <= 20
}

func boolToInt(value bool) int {
	if value {
		return 1
	}

	return 0
}
