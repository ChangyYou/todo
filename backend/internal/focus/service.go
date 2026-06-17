package focus

import (
	"database/sql"
	"errors"
	"strconv"
	"strings"
	"time"

	"todo/backend/internal/models"
)

var ErrInvalidFocusSession = errors.New("invalid focus session")

const (
	maxStatsRangeDays         = 366
	minRecordableFocusSeconds = 5
)

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) Create(userID, todoID, sceneID int64, durationSeconds int, sessionDate string) error {
	sessionDate = strings.TrimSpace(sessionDate)
	if sessionDate == "" {
		sessionDate = time.Now().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", sessionDate); err != nil {
		return ErrInvalidFocusSession
	}
	if userID <= 0 || durationSeconds <= minRecordableFocusSeconds {
		return ErrInvalidFocusSession
	}

	if todoID > 0 {
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
	}

	if sceneID > 0 {
		var exists int
		err := s.db.QueryRow(
			"SELECT 1 FROM focus_scenes WHERE id = ? AND user_id = ? AND active = 1",
			sceneID,
			userID,
		).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return ErrInvalidFocusSession
		}
		if err != nil {
			return err
		}
	}

	_, err := s.db.Exec(
		"INSERT INTO focus_sessions (user_id, todo_id, scene_id, duration_seconds, session_date) VALUES (?, ?, ?, ?, ?)",
		userID,
		todoID,
		nullableSceneID(sceneID),
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

func (s *Service) Stats(userID int64, startDate, endDate, period string) (models.FocusStats, error) {
	period = normalizeStatsPeriod(period)
	start, end, periods, err := normalizeStatsRange(startDate, endDate, period)
	if err != nil || userID <= 0 {
		return models.FocusStats{}, ErrInvalidFocusSession
	}

	stats := models.FocusStats{
		StartDate: start.Format("2006-01-02"),
		EndDate:   end.Format("2006-01-02"),
		Period:    period,
		Periods:   periods,
		Daily:     buildEmptyDailyStats(start, end),
		HabitWeek: buildEmptyHabitWeek(time.Now()),
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
	if err := s.fillPeriodStats(userID, stats.Periods); err != nil {
		return models.FocusStats{}, err
	}
	if err := s.fillTaskCompletionStats(userID, stats.Periods); err != nil {
		return models.FocusStats{}, err
	}
	overview, err := s.overview(userID)
	if err != nil {
		return models.FocusStats{}, err
	}
	stats.Overview = overview
	habitWeek, err := s.habitWeek(userID, time.Now())
	if err != nil {
		return models.FocusStats{}, err
	}
	stats.HabitWeek = habitWeek

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

func (s *Service) ReviewCalendar(userID int64, year, month int) (models.ReviewCalendar, error) {
	if userID <= 0 {
		return models.ReviewCalendar{}, ErrInvalidFocusSession
	}
	now := time.Now()
	if year == 0 {
		year = now.Year()
	}
	if month == 0 {
		month = int(now.Month())
	}
	if month < 1 || month > 12 {
		return models.ReviewCalendar{}, ErrInvalidFocusSession
	}

	firstOfMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.Local)
	gridStart := firstOfMonth.AddDate(0, 0, -int(firstOfMonth.Weekday()))
	gridEnd := gridStart.AddDate(0, 0, 41)
	calendar := models.ReviewCalendar{
		Year:  year,
		Month: month,
		Days:  buildEmptyReviewDays(gridStart, firstOfMonth, now),
	}
	byDate := make(map[string]int, len(calendar.Days))
	for index, day := range calendar.Days {
		byDate[day.Date] = index
	}

	if err := s.fillReviewTodos(userID, gridStart.Format("2006-01-02"), gridEnd.Format("2006-01-02"), calendar.Days, byDate); err != nil {
		return models.ReviewCalendar{}, err
	}
	if err := s.fillReviewFocus(userID, gridStart.Format("2006-01-02"), gridEnd.Format("2006-01-02"), calendar.Days, byDate); err != nil {
		return models.ReviewCalendar{}, err
	}
	if err := s.fillReviewTaskStats(userID, gridStart.Format("2006-01-02"), gridEnd.Format("2006-01-02"), calendar.Days, byDate); err != nil {
		return models.ReviewCalendar{}, err
	}
	if err := s.fillReviewTaskScenes(userID, gridStart.Format("2006-01-02"), gridEnd.Format("2006-01-02"), calendar.Days, byDate); err != nil {
		return models.ReviewCalendar{}, err
	}
	if err := s.fillReviewSceneStats(userID, gridStart.Format("2006-01-02"), gridEnd.Format("2006-01-02"), calendar.Days, byDate); err != nil {
		return models.ReviewCalendar{}, err
	}

	return calendar, nil
}

func (s *Service) fillReviewTodos(userID int64, startDate, endDate string, days []models.ReviewCalendarDay, byDate map[string]int) error {
	rows, err := s.db.Query(
		`SELECT id, todo_date, source_type, title
		   FROM todos
		  WHERE user_id = ?
		    AND completed = 1
		    AND deleted_at IS NULL
		    AND todo_date BETWEEN ? AND ?
		  ORDER BY completed_at ASC, id ASC`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var todoID int64
		var date string
		var sourceType string
		var title string
		if err := rows.Scan(&todoID, &date, &sourceType, &title); err != nil {
			return err
		}
		index, ok := byDate[date]
		if !ok {
			continue
		}
		entryType := "task"
		meta := "完成"
		if sourceType == "habit" {
			entryType = "habit"
			meta = "打卡"
			days[index].CompletedHabits++
		} else {
			days[index].CompletedTasks++
		}
		if len(days[index].Entries) < 4 {
			days[index].Entries = append(days[index].Entries, models.ReviewCalendarEntry{
				TodoID: todoID,
				Type:   entryType,
				Title:  title,
				Meta:   meta,
			})
		}
	}

	return rows.Err()
}

func (s *Service) fillReviewFocus(userID int64, startDate, endDate string, days []models.ReviewCalendarDay, byDate map[string]int) error {
	rows, err := s.db.Query(
		`SELECT focus_sessions.session_date,
		        focus_sessions.todo_id,
		        COALESCE(focus_sessions.scene_id, 0) AS scene_id,
		        COALESCE(todos.title, focus_scenes.title, '') AS title,
		        CASE
		          WHEN focus_sessions.todo_id > 0 THEN 'focus'
		          WHEN focus_sessions.scene_id IS NOT NULL THEN 'scene'
		          ELSE 'focus'
		        END AS entry_type,
		        COALESCE(focus_scenes.title, '') AS scene_title,
		        COALESCE(focus_scenes.color, '#4b8768') AS scene_color,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS duration_seconds,
		        COUNT(*) AS session_count
		   FROM focus_sessions
		   LEFT JOIN todos ON todos.id = focus_sessions.todo_id AND todos.user_id = focus_sessions.user_id
		   LEFT JOIN focus_scenes ON focus_scenes.id = focus_sessions.scene_id AND focus_scenes.user_id = focus_sessions.user_id
		  WHERE focus_sessions.user_id = ? AND focus_sessions.session_date BETWEEN ? AND ?
		  GROUP BY focus_sessions.session_date,
		           focus_sessions.todo_id,
		           scene_id,
		           COALESCE(todos.title, focus_scenes.title, ''),
		           scene_title,
		           scene_color,
		           entry_type
		  ORDER BY focus_sessions.session_date ASC, duration_seconds DESC`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var date string
		var todoID sql.NullInt64
		var sceneID int64
		var title string
		var entryType string
		var sceneTitle string
		var sceneColor string
		var durationSeconds int64
		var sessionCount int64
		if err := rows.Scan(&date, &todoID, &sceneID, &title, &entryType, &sceneTitle, &sceneColor, &durationSeconds, &sessionCount); err != nil {
			return err
		}
		index, ok := byDate[date]
		if !ok {
			continue
		}
		days[index].FocusSeconds += durationSeconds
		if entryType == "scene" {
			days[index].SceneCount++
		}
		if title != "" && len(days[index].Entries) < 4 {
			entryTodoID := int64(0)
			if todoID.Valid {
				entryTodoID = todoID.Int64
			}
			if entryTodoID > 0 && hasReviewEntryForTodo(days[index].Entries, entryTodoID) {
				continue
			}
			days[index].Entries = append(days[index].Entries, models.ReviewCalendarEntry{
				TodoID:     entryTodoID,
				SceneID:    sceneID,
				Type:       entryType,
				Title:      title,
				Meta:       formatReviewFocusMeta(durationSeconds, sessionCount),
				SceneTitle: sceneTitle,
				SceneColor: sceneColor,
			})
		}
	}

	return rows.Err()
}

func hasReviewEntryForTodo(entries []models.ReviewCalendarEntry, todoID int64) bool {
	for _, entry := range entries {
		if entry.TodoID == todoID {
			return true
		}
	}
	return false
}

func (s *Service) fillReviewTaskStats(userID int64, startDate, endDate string, days []models.ReviewCalendarDay, byDate map[string]int) error {
	rows, err := s.db.Query(
		`SELECT todos.id,
		        todos.todo_date,
		        todos.title,
		        todos.source_type,
		        todos.completed,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS focus_seconds,
		        COUNT(focus_sessions.id) AS session_count,
		        COALESCE(todos.completed_at, '') AS completed_at
		   FROM todos
		   LEFT JOIN focus_sessions ON focus_sessions.todo_id = todos.id AND focus_sessions.user_id = todos.user_id
		  WHERE todos.user_id = ?
		    AND todos.deleted_at IS NULL
		    AND todos.todo_date BETWEEN ? AND ?
		  GROUP BY todos.id
		 HAVING todos.completed = 1 OR COUNT(focus_sessions.id) > 0
		  ORDER BY todos.todo_date ASC,
		           CASE todos.source_type WHEN 'todo' THEN 1 ELSE 2 END ASC,
		           focus_seconds DESC,
		           todos.id DESC`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.ReviewTaskStat
		var date string
		var completed int
		if err := rows.Scan(&item.TodoID, &date, &item.Title, &item.SourceType, &completed, &item.FocusSeconds, &item.SessionCount, &item.CompletedAt); err != nil {
			return err
		}
		index, ok := byDate[date]
		if !ok {
			continue
		}
		item.Completed = completed == 1
		days[index].Tasks = append(days[index].Tasks, item)
	}

	return rows.Err()
}

func (s *Service) fillReviewTaskScenes(userID int64, startDate, endDate string, days []models.ReviewCalendarDay, byDate map[string]int) error {
	rows, err := s.db.Query(
		`SELECT focus_sessions.todo_id,
		        focus_sessions.session_date,
		        focus_sessions.scene_id,
		        COALESCE(focus_scenes.title, '') AS scene_title,
		        COALESCE(focus_scenes.color, '#4b8768') AS scene_color,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS scene_seconds,
		        COUNT(*) AS scene_sessions
		   FROM focus_sessions
		   LEFT JOIN focus_scenes ON focus_scenes.id = focus_sessions.scene_id AND focus_scenes.user_id = focus_sessions.user_id
		  WHERE focus_sessions.user_id = ?
		    AND focus_sessions.todo_id > 0
		    AND focus_sessions.scene_id IS NOT NULL
		    AND focus_sessions.session_date BETWEEN ? AND ?
		  GROUP BY focus_sessions.todo_id,
		           focus_sessions.session_date,
		           focus_sessions.scene_id,
		           scene_title,
		           scene_color
		  ORDER BY focus_sessions.session_date ASC, focus_sessions.todo_id ASC, scene_seconds DESC, scene_sessions DESC`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var todoID int64
		var date string
		var sceneID int64
		var sceneTitle string
		var sceneColor string
		var sceneSeconds int64
		var sceneSessions int64
		if err := rows.Scan(&todoID, &date, &sceneID, &sceneTitle, &sceneColor, &sceneSeconds, &sceneSessions); err != nil {
			return err
		}
		index, ok := byDate[date]
		if !ok {
			continue
		}
		for taskIndex := range days[index].Tasks {
			task := &days[index].Tasks[taskIndex]
			if task.TodoID != todoID || task.SceneID > 0 {
				continue
			}
			task.SceneID = sceneID
			task.SceneTitle = sceneTitle
			task.SceneColor = sceneColor
			break
		}
	}

	return rows.Err()
}

func (s *Service) fillReviewSceneStats(userID int64, startDate, endDate string, days []models.ReviewCalendarDay, byDate map[string]int) error {
	rows, err := s.db.Query(
		`SELECT focus_sessions.scene_id,
		        focus_sessions.session_date,
		        COALESCE(focus_scenes.title, '已删除场景') AS title,
		        COALESCE(focus_scenes.color, '#4b8768') AS scene_color,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS focus_seconds,
		        COUNT(*) AS session_count
		   FROM focus_sessions
		   LEFT JOIN focus_scenes ON focus_scenes.id = focus_sessions.scene_id AND focus_scenes.user_id = focus_sessions.user_id
		  WHERE focus_sessions.user_id = ?
		    AND focus_sessions.scene_id IS NOT NULL
		    AND focus_sessions.todo_id <= 0
		    AND focus_sessions.session_date BETWEEN ? AND ?
		  GROUP BY focus_sessions.scene_id, focus_sessions.session_date, title, scene_color
		  ORDER BY focus_sessions.session_date ASC, focus_seconds DESC`,
		userID,
		startDate,
		endDate,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var item models.ReviewTaskStat
		var date string
		if err := rows.Scan(&item.SceneID, &date, &item.Title, &item.SceneColor, &item.FocusSeconds, &item.SessionCount); err != nil {
			return err
		}
		index, ok := byDate[date]
		if !ok {
			continue
		}
		item.SourceType = "scene"
		item.SceneTitle = item.Title
		days[index].Tasks = append(days[index].Tasks, item)
	}

	return rows.Err()
}

func (s *Service) DeleteReviewTodo(userID, todoID int64) error {
	if userID <= 0 || todoID <= 0 {
		return ErrInvalidFocusSession
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM focus_sessions WHERE user_id = ? AND todo_id = ?`, userID, todoID); err != nil {
		return err
	}

	result, err := tx.Exec(`DELETE FROM todos WHERE id = ? AND user_id = ?`, todoID, userID)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return tx.Commit()
}

func (s *Service) overview(userID int64) (models.FocusStatsOverview, error) {
	today := time.Now().Format("2006-01-02")
	var overview models.FocusStatsOverview

	if err := s.db.QueryRow(
		`SELECT COUNT(*)
		   FROM todos
		  WHERE user_id = ? AND source_type = 'todo' AND completed = 1 AND DATE(completed_at) = ?`,
		userID,
		today,
	).Scan(&overview.TodayCompletedTasks); err != nil {
		return overview, err
	}
	if err := s.db.QueryRow(
		`SELECT COUNT(*)
		   FROM todos
		  WHERE user_id = ? AND source_type = 'todo' AND completed = 1`,
		userID,
	).Scan(&overview.TotalCompletedTasks); err != nil {
		return overview, err
	}
	if err := s.db.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
		   FROM focus_sessions
		  WHERE user_id = ? AND session_date = ?`,
		userID,
		today,
	).Scan(&overview.TodayPomodoros, &overview.TodayFocusSeconds); err != nil {
		return overview, err
	}
	if err := s.db.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
		   FROM focus_sessions
		  WHERE user_id = ?`,
		userID,
	).Scan(&overview.TotalPomodoros, &overview.TotalFocusSeconds); err != nil {
		return overview, err
	}

	return overview, nil
}

func (s *Service) fillPeriodStats(userID int64, periods []models.FocusStatsPeriod) error {
	for index := range periods {
		if err := s.db.QueryRow(
			`SELECT COUNT(*), COALESCE(SUM(duration_seconds), 0)
			   FROM focus_sessions
			  WHERE user_id = ? AND session_date BETWEEN ? AND ?`,
			userID,
			periods[index].StartDate,
			periods[index].EndDate,
		).Scan(&periods[index].SessionCount, &periods[index].DurationSeconds); err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) fillTaskCompletionStats(userID int64, periods []models.FocusStatsPeriod) error {
	for index := range periods {
		if err := s.db.QueryRow(
			`SELECT COUNT(*),
			        COALESCE(SUM(CASE
			          WHEN completed = 1 AND completed_at IS NOT NULL AND DATE(completed_at) BETWEEN ? AND ? THEN 1
			          ELSE 0
			        END), 0)
			   FROM todos
			  WHERE user_id = ?
			    AND source_type = 'todo'
			    AND deleted_at IS NULL
			    AND todo_date BETWEEN ? AND ?`,
			periods[index].StartDate,
			periods[index].EndDate,
			userID,
			periods[index].StartDate,
			periods[index].EndDate,
		).Scan(&periods[index].TaskTotal, &periods[index].TaskCompleted); err != nil {
			return err
		}
		if periods[index].TaskTotal > 0 {
			periods[index].TaskCompletionRate = (periods[index].TaskCompleted * 100) / periods[index].TaskTotal
		}
	}
	return nil
}

func (s *Service) habitWeek(userID int64, now time.Time) ([]models.FocusStatsHabitDay, error) {
	result := buildEmptyHabitWeek(now)
	for index := range result {
		rows, err := s.db.Query(
			`SELECT title, completed
			   FROM todos
			  WHERE user_id = ?
			    AND source_type = 'habit'
			    AND deleted_at IS NULL
			    AND todo_date = ?
			  ORDER BY title ASC, id ASC`,
			userID,
			result[index].Date,
		)
		if err != nil {
			return nil, err
		}

		for rows.Next() {
			var title string
			var completed bool
			if err := rows.Scan(&title, &completed); err != nil {
				rows.Close()
				return nil, err
			}
			result[index].Total++
			if completed {
				result[index].Checked++
				result[index].CompletedHabits = append(result[index].CompletedHabits, title)
			} else {
				result[index].PendingHabits = append(result[index].PendingHabits, title)
			}
		}
		if err := rows.Close(); err != nil {
			return nil, err
		}
		if err := rows.Err(); err != nil {
			return nil, err
		}
		if result[index].Total > 0 {
			result[index].Completion = (result[index].Checked * 100) / result[index].Total
		}
	}
	return result, nil
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
		  WHERE focus_sessions.user_id = ? AND focus_sessions.session_date BETWEEN ? AND ? AND focus_sessions.todo_id > 0
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
		        CASE
		          WHEN focus_sessions.todo_id > 0 THEN COALESCE(todos.title, '已删除任务')
		          WHEN focus_sessions.scene_id IS NOT NULL THEN COALESCE(focus_scenes.title, '已删除场景')
		          ELSE '自由专注'
		        END AS title,
		        focus_sessions.duration_seconds,
		        focus_sessions.session_date,
		        focus_sessions.created_at
		   FROM focus_sessions
		   LEFT JOIN todos ON todos.id = focus_sessions.todo_id AND todos.user_id = focus_sessions.user_id
		   LEFT JOIN focus_scenes ON focus_scenes.id = focus_sessions.scene_id AND focus_scenes.user_id = focus_sessions.user_id
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

func normalizeStatsPeriod(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "week" || value == "month" {
		return value
	}
	return "day"
}

func normalizeStatsRange(startDate, endDate, period string) (time.Time, time.Time, []models.FocusStatsPeriod, error) {
	endDate = strings.TrimSpace(endDate)
	if endDate == "" {
		endDate = time.Now().Format("2006-01-02")
	}

	end, err := time.Parse("2006-01-02", endDate)
	if err != nil {
		return time.Time{}, time.Time{}, nil, err
	}

	startDate = strings.TrimSpace(startDate)
	if startDate == "" {
		startDate = defaultPeriodStart(end, period).Format("2006-01-02")
	}

	start, err := time.Parse("2006-01-02", startDate)
	if err != nil {
		return time.Time{}, time.Time{}, nil, err
	}

	if start.After(end) || int(end.Sub(start).Hours()/24) >= maxStatsRangeDays {
		return time.Time{}, time.Time{}, nil, ErrInvalidFocusSession
	}

	periods := buildEmptyPeriodStats(start, end, period)
	return start, end, periods, nil
}

func buildEmptyDailyStats(start, end time.Time) []models.FocusStatsDay {
	days := make([]models.FocusStatsDay, 0, int(end.Sub(start).Hours()/24)+1)
	for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
		days = append(days, models.FocusStatsDay{Date: day.Format("2006-01-02")})
	}
	return days
}

func buildEmptyPeriodStats(start, end time.Time, period string) []models.FocusStatsPeriod {
	periods := make([]models.FocusStatsPeriod, 0, 7)
	switch period {
	case "week":
		weekStart := startOfWeek(start)
		for day := weekStart; !day.After(end); day = day.AddDate(0, 0, 7) {
			periodEnd := day.AddDate(0, 0, 6)
			periods = append(periods, models.FocusStatsPeriod{
				Label:     labelWeek(day),
				StartDate: day.Format("2006-01-02"),
				EndDate:   minDate(periodEnd, end).Format("2006-01-02"),
			})
		}
	case "month":
		monthStart := time.Date(start.Year(), start.Month(), 1, 0, 0, 0, 0, start.Location())
		for day := monthStart; !day.After(end); day = day.AddDate(0, 1, 0) {
			periodEnd := day.AddDate(0, 1, -1)
			periods = append(periods, models.FocusStatsPeriod{
				Label:     labelMonth(day),
				StartDate: day.Format("2006-01-02"),
				EndDate:   minDate(periodEnd, end).Format("2006-01-02"),
			})
		}
	default:
		for day := start; !day.After(end); day = day.AddDate(0, 0, 1) {
			periods = append(periods, models.FocusStatsPeriod{
				Label:     labelDay(day),
				StartDate: day.Format("2006-01-02"),
				EndDate:   day.Format("2006-01-02"),
			})
		}
	}

	if len(periods) > 7 {
		return periods[len(periods)-7:]
	}
	return periods
}

func buildEmptyHabitWeek(now time.Time) []models.FocusStatsHabitDay {
	labels := []string{"一", "二", "三", "四", "五", "六", "日"}
	start := startOfWeek(now)
	result := make([]models.FocusStatsHabitDay, 0, 7)
	for index := 0; index < 7; index++ {
		day := start.AddDate(0, 0, index)
		result = append(result, models.FocusStatsHabitDay{
			Date:            day.Format("2006-01-02"),
			Label:           labels[index],
			CompletedHabits: make([]string, 0),
			PendingHabits:   make([]string, 0),
		})
	}
	return result
}

func buildEmptyReviewDays(gridStart, monthStart, now time.Time) []models.ReviewCalendarDay {
	days := make([]models.ReviewCalendarDay, 0, 42)
	currentMonth := monthStart.Month()
	today := now.Format("2006-01-02")
	for offset := 0; offset < 42; offset++ {
		day := gridStart.AddDate(0, 0, offset)
		date := day.Format("2006-01-02")
		days = append(days, models.ReviewCalendarDay{
			Date:           date,
			Day:            day.Day(),
			InCurrentMonth: day.Month() == currentMonth,
			IsToday:        date == today,
			Entries:        make([]models.ReviewCalendarEntry, 0),
			Tasks:          make([]models.ReviewTaskStat, 0),
		})
	}
	return days
}

func nullableSceneID(sceneID int64) interface{} {
	if sceneID <= 0 {
		return nil
	}
	return sceneID
}

func formatReviewFocusMeta(durationSeconds int64, sessionCount int64) string {
	minutes := durationSeconds / 60
	if minutes <= 0 {
		minutes = 1
	}
	if sessionCount > 1 {
		return strconv.FormatInt(minutes, 10) + "m · " + strconv.FormatInt(sessionCount, 10) + "轮"
	}
	return strconv.FormatInt(minutes, 10) + "m"
}

func defaultPeriodStart(end time.Time, period string) time.Time {
	switch period {
	case "week":
		return startOfWeek(end).AddDate(0, 0, -42)
	case "month":
		monthStart := time.Date(end.Year(), end.Month(), 1, 0, 0, 0, 0, end.Location())
		return monthStart.AddDate(0, -6, 0)
	default:
		return end.AddDate(0, 0, -6)
	}
}

func startOfWeek(value time.Time) time.Time {
	offset := (int(value.Weekday()) + 6) % 7
	return value.AddDate(0, 0, -offset)
}

func minDate(a, b time.Time) time.Time {
	if a.After(b) {
		return b
	}
	return a
}

func labelDay(value time.Time) string {
	if value.Format("2006-01-02") == time.Now().Format("2006-01-02") {
		return "今天"
	}
	return value.Format("2日")
}

func labelWeek(value time.Time) string {
	_, week := value.ISOWeek()
	return "W" + strconv.Itoa(week)
}

func labelMonth(value time.Time) string {
	return value.Format("1月")
}
