package focus

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

var ErrInvalidFocusSession = errors.New("invalid focus session")

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) Create(userID, todoID int64, durationSeconds int, sessionDate string) error {
	sessionDate = strings.TrimSpace(sessionDate)
	if sessionDate == "" {
		sessionDate = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", sessionDate); err != nil {
		return ErrInvalidFocusSession
	}
	if userID <= 0 || todoID <= 0 || durationSeconds <= 0 {
		return ErrInvalidFocusSession
	}

	var exists int
	err := s.db.QueryRow("SELECT 1 FROM todos WHERE id = ? AND user_id = ?", todoID, userID).Scan(&exists)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidFocusSession
	}
	if err != nil {
		return err
	}

	_, err = s.db.Exec(
		"INSERT INTO focus_sessions (user_id, todo_id, duration_seconds, session_date) VALUES (?, ?, ?, ?)",
		userID,
		todoID,
		durationSeconds,
		sessionDate,
	)
	return err
}
