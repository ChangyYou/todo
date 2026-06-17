package focus

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"todo/backend/internal/models"
)

var ErrInvalidFocusSession = errors.New("invalid focus session")

const maxStatsRangeDays = 366

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
	err := s.db.QueryRow(
		"SELECT 1 FROM todos WHERE id = ? AND user_id = ? AND deleted_at IS NULL",
		todoID,
		userID,
	).Scan(&exists)
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

func (s *Service) SummaryByDate(userID int64, sessionDate string) (models.FocusSummary, error) {
	sessionDate = strings.TrimSpace(sessionDate)
	if sessionDate == "" {
		sessionDate = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", sessionDate); err != nil {
		return models.FocusSummary{}, ErrInvalidFocusSession
	}
	if userID <= 0 {
		return models.FocusSummary{}, ErrInvalidFocusSession
	}

	var durationSeconds int64
	err := s.db.QueryRow(
		`SELECT COALESCE(SUM(duration_seconds), 0)
		   FROM focus_sessions
		  WHERE user_id = ? AND session_date = ?`,
		userID,
		sessionDate,
	).Scan(&durationSeconds)
	if err != nil {
		return models.FocusSummary{}, err
	}

	return models.FocusSummary{
		SessionDate:     sessionDate,
		DurationSeconds: durationSeconds,
	}, nil
}

func (s *Service) Stats(userID int64, startDate, endDate string) (models.FocusStats, error) {
	start, end, err := normalizeStatsRange(startDate, endDate)
	if err != nil || userID <= 0 {
		return models.FocusStats{}, ErrInvalidFocusSession
	}

	stats := models.FocusStats{
		StartDate: start.Format("2006-01-02"),
		EndDate:   end.Format("2006-01-02"),
		Daily:     buildEmptyDailyStats(start, end),
		ByTask:    make([]models.FocusStatsTask, 0),
		Recent:    make([]models.FocusStatsEntry, 0),
	}

	if err := s.db.QueryRow(
		`SELECT COALESCE(SUM(duration_seconds), 0), COUNT(*)
		   FROM focus_sessions
		  WHERE user_id = ? AND session_date BETWEEN ? AND ?`,
		userID,
		stats.StartDate,
		stats.EndDate,
	).Scan(&stats.Summary.DurationSeconds, &stats.Summary.SessionCount); err != nil {
		return models.FocusStats{}, err
	}

	if err := s.fillDailyStats(userID, stats.StartDate, stats.EndDate, stats.Daily); err != nil {
		return models.FocusStats{}, err
	}

	byTask, err := s.listTaskStats(userID, stats.StartDate, stats.EndDate)
	if err != nil {
		return models.FocusStats{}, err
	}
	stats.ByTask = byTask

	recent, err := s.listRecentStats(userID, stats.StartDate, stats.EndDate)
	if err != nil {
		return models.FocusStats{}, err
	}
	stats.Recent = recent

	return stats, nil
}

func (s *Service) fillDailyStats(userID int64, startDate, endDate string, daily []models.FocusStatsDay) error {
	rows, err := s.db.Query(
		`SELECT session_date, COALESCE(SUM(duration_seconds), 0), COUNT(*)
		   FROM focus_sessions
		  WHERE user_id = ? AND session_date BETWEEN ? AND ?
		  GROUP BY session_date`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	byDate := make(map[string]int, len(daily))
	for index, day := range daily {
		byDate[day.Date] = index
	}

	for rows.Next() {
		var day models.FocusStatsDay
		if err := rows.Scan(&day.Date, &day.DurationSeconds, &day.SessionCount); err != nil {
			return err
		}
		if index, ok := byDate[day.Date]; ok {
			daily[index] = day
		}
	}

	return rows.Err()
}

func (s *Service) listTaskStats(userID int64, startDate, endDate string) ([]models.FocusStatsTask, error) {
	rows, err := s.db.Query(
		`SELECT focus_sessions.todo_id,
		        COALESCE(todos.title, '已删除任务') AS title,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS duration_seconds,
		        COUNT(*) AS session_count
		   FROM focus_sessions
		   LEFT JOIN todos ON todos.id = focus_sessions.todo_id AND todos.user_id = focus_sessions.user_id
		  WHERE focus_sessions.user_id = ? AND focus_sessions.session_date BETWEEN ? AND ?
		  GROUP BY focus_sessions.todo_id, title
		  ORDER BY duration_seconds DESC, session_count DESC, focus_sessions.todo_id DESC
		  LIMIT 8`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.FocusStatsTask, 0)
	for rows.Next() {
		var item models.FocusStatsTask
		if err := rows.Scan(&item.TodoID, &item.Title, &item.DurationSeconds, &item.SessionCount); err != nil {
			return nil, err
		}
		result = append(result, item)
	}

	return result, rows.Err()
}

func (s *Service) listRecentStats(userID int64, startDate, endDate string) ([]models.FocusStatsEntry, error) {
	rows, err := s.db.Query(
		`SELECT focus_sessions.todo_id,
		        COALESCE(todos.title, '已删除任务') AS title,
		        focus_sessions.duration_seconds,
		        focus_sessions.session_date,
		        focus_sessions.created_at
		   FROM focus_sessions
		   LEFT JOIN todos ON todos.id = focus_sessions.todo_id AND todos.user_id = focus_sessions.user_id
		  WHERE focus_sessions.user_id = ? AND focus_sessions.session_date BETWEEN ? AND ?
		  ORDER BY focus_sessions.created_at DESC, focus_sessions.id DESC
		  LIMIT 6`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.FocusStatsEntry, 0)
	for rows.Next() {
		var item models.FocusStatsEntry
		if err := rows.Scan(&item.TodoID, &item.Title, &item.DurationSeconds, &item.SessionDate, &item.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}

	return result, rows.Err()
}

func normalizeStatsRange(startDate, endDate string) (time.Time, time.Time, error) {
	endDate = strings.TrimSpace(endDate)
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	startDate = strings.TrimSpace(startDate)
	if startDate == "" {
		startDate = end.AddDate(0, 0, -6).Format("2006-01-02")
	}

	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return time.Time{}, time.Time{}, err
	}

	if start.After(end) || int(end.Sub(start).Hours()/24) >= maxStatsRangeDays {
		return time.Time{}, time.Time{}, ErrInvalidFocusSession
	}

	return start, end, nil
}

func buildEmptyDailyStats(start, end time.Time) []models.FocusStatsDay {
	days := make([]models.FocusStatsDay, 0, int(end.Sub(start).Hours()/24)+1)
	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		days = append(days, models.FocusStatsDay{Date: day.Format("2006-01-02")})
	}
	return days
}
