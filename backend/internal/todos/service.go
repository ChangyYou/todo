package todos

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"todo/backend/internal/models"
)

var ErrInvalidTodo = errors.New("invalid todo")

const (
	priorityLow       = "low"
	priorityMedium    = "medium"
	priorityHigh      = "high"
	timeTypeDateRange = "date_range"
	timeTypeMoment    = "moment"
	todoStatusActive  = "active"
	todoStatusAll     = "all"
	todoStatusDone    = "completed"
)

type Service struct {
	db *sql.DB
}

type TodoInput struct {
	Title     string
	TodoDate  string
	TimeType  string
	StartDate string
	EndDate   string
	StartTime string
	EndTime   string
	Priority  string
}

type TodoPatch struct {
	Title     *string
	Completed *bool
	TodoDate  *string
	TimeType  *string
	StartDate *string
	EndDate   *string
	StartTime *string
	EndTime   *string
	Priority  *string
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) List(userID int64, todoDate, status string) ([]models.Todo, error) {
	todoDate = strings.TrimSpace(todoDate)
	habitDate := todoDate
	if habitDate == "" {
		habitDate = time.Now().Format("2006-01-02")
	} else {
		habitDate = normalizeDate(habitDate)
	}

	if err := s.ensureHabitsForDate(userID, habitDate); err != nil {
		return nil, err
	}

	status = normalizeTodoStatus(status)
	filterClause := "todos.user_id = ? AND todos.deleted_at IS NULL"
	args := []interface{}{userID}
	switch status {
	case todoStatusDone:
		filterClause += " AND todos.completed = 1"
	case todoStatusActive:
		filterClause += " AND todos.completed = 0"
	}
	if todoDate != "" {
		filterClause = `todos.user_id = ? AND todos.deleted_at IS NULL
			AND COALESCE(todos.start_date, todos.todo_date) <= ?
			AND COALESCE(todos.end_date, todos.todo_date) >= ?`
		switch status {
		case todoStatusDone:
			filterClause += " AND todos.completed = 1"
		case todoStatusActive:
			filterClause += " AND todos.completed = 0"
		}
		args = append(args, habitDate, habitDate)
	}

	rows, err := s.db.Query(
		`SELECT todos.id,
		        todos.title,
		        todos.completed,
		        todos.todo_date,
		        COALESCE(todos.time_type, 'date_range') AS time_type,
		        COALESCE(todos.start_date, todos.todo_date) AS start_date,
		        COALESCE(todos.end_date, todos.todo_date) AS end_date,
		        COALESCE(todos.start_time, '') AS start_time,
		        COALESCE(todos.end_time, '') AS end_time,
		        todos.priority,
		        todos.source_type,
		        todos.habit_id,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS focus_seconds,
		        todos.created_at,
		        todos.updated_at
		 FROM todos
		 LEFT JOIN focus_sessions ON focus_sessions.todo_id = todos.id AND focus_sessions.user_id = todos.user_id
		 WHERE `+filterClause+`
		 GROUP BY todos.id
		 ORDER BY todos.completed ASC,
		          CASE todos.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END ASC,
		          COALESCE(todos.start_date, todos.todo_date) ASC,
		          todos.start_time ASC,
		          todos.source_type ASC,
		          todos.id DESC`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Todo, 0)
	for rows.Next() {
		todo, err := scanTodo(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, todo)
	}

	return result, rows.Err()
}

func (s *Service) Create(userID int64, input TodoInput) (models.Todo, error) {
	normalized, err := normalizeInput(input)
	if err != nil {
		return models.Todo{}, ErrInvalidTodo
	}

	result, err := s.db.Exec(
		`INSERT INTO todos (user_id, title, todo_date, time_type, start_date, end_date, start_time, end_time, priority, source_type)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'todo')`,
		userID,
		normalized.Title,
		normalized.TodoDate,
		normalized.TimeType,
		normalized.StartDate,
		normalized.EndDate,
		nullableText(normalized.StartTime),
		nullableText(normalized.EndTime),
		normalized.Priority,
	)
	if err != nil {
		return models.Todo{}, err
	}

	todoID, err := result.LastInsertId()
	if err != nil {
		return models.Todo{}, err
	}

	return s.byID(userID, todoID)
}

func (s *Service) Update(userID, todoID int64, patch TodoPatch) (models.Todo, error) {
	if patch.Title == nil && patch.Completed == nil && patch.TodoDate == nil && patch.TimeType == nil && patch.StartDate == nil && patch.EndDate == nil && patch.StartTime == nil && patch.EndTime == nil && patch.Priority == nil {
		return s.byID(userID, todoID)
	}

	current, err := s.byID(userID, todoID)
	if err != nil {
		return models.Todo{}, err
	}

	nextTitle := current.Title
	if patch.Title != nil {
		nextTitle = strings.TrimSpace(*patch.Title)
		if nextTitle == "" {
			return models.Todo{}, ErrInvalidTodo
		}
	}

	nextCompleted := current.Completed
	if patch.Completed != nil {
		nextCompleted = *patch.Completed
	}

	nextPriority := current.Priority
	if patch.Priority != nil {
		nextPriority = normalizePriority(*patch.Priority)
		if nextPriority == "" {
			return models.Todo{}, ErrInvalidTodo
		}
	}

	input := TodoInput{
		Title:     nextTitle,
		TodoDate:  current.TodoDate,
		TimeType:  current.TimeType,
		StartDate: current.StartDate,
		EndDate:   current.EndDate,
		StartTime: current.StartTime,
		EndTime:   current.EndTime,
		Priority:  nextPriority,
	}
	if patch.TodoDate != nil {
		input.TodoDate = *patch.TodoDate
	}
	if patch.TimeType != nil {
		input.TimeType = *patch.TimeType
	}
	if patch.StartDate != nil {
		input.StartDate = *patch.StartDate
	}
	if patch.EndDate != nil {
		input.EndDate = *patch.EndDate
	}
	if patch.StartTime != nil {
		input.StartTime = *patch.StartTime
	}
	if patch.EndTime != nil {
		input.EndTime = *patch.EndTime
	}

	normalized, err := normalizeInput(input)
	if err != nil {
		return models.Todo{}, ErrInvalidTodo
	}

	_, err = s.db.Exec(
		`UPDATE todos
		 SET title = ?,
		     completed = ?,
		     completed_at = CASE
		       WHEN ? = 1 AND completed_at IS NULL THEN CURRENT_TIMESTAMP
		       WHEN ? = 0 THEN NULL
		       ELSE completed_at
		     END,
		     todo_date = ?,
		     time_type = ?,
		     start_date = ?,
		     end_date = ?,
		     start_time = ?,
		     end_time = ?,
		     priority = ?,
		     updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ?`,
		normalized.Title,
		boolToInt(nextCompleted),
		boolToInt(nextCompleted),
		boolToInt(nextCompleted),
		normalized.TodoDate,
		normalized.TimeType,
		normalized.StartDate,
		normalized.EndDate,
		nullableText(normalized.StartTime),
		nullableText(normalized.EndTime),
		normalized.Priority,
		todoID,
		userID,
	)
	if err != nil {
		return models.Todo{}, err
	}

	return s.byID(userID, todoID)
}

func (s *Service) Delete(userID, todoID int64) error {
	_, err := s.db.Exec(
		`UPDATE todos
		 SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ? AND deleted_at IS NULL`,
		todoID,
		userID,
	)
	return err
}

func (s *Service) byID(userID, todoID int64) (models.Todo, error) {
	row := s.db.QueryRow(
		`SELECT todos.id,
		        todos.title,
		        todos.completed,
		        todos.todo_date,
		        COALESCE(todos.time_type, 'date_range') AS time_type,
		        COALESCE(todos.start_date, todos.todo_date) AS start_date,
		        COALESCE(todos.end_date, todos.todo_date) AS end_date,
		        COALESCE(todos.start_time, '') AS start_time,
		        COALESCE(todos.end_time, '') AS end_time,
		        todos.priority,
		        todos.source_type,
		        todos.habit_id,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS focus_seconds,
		        todos.created_at,
		        todos.updated_at
		 FROM todos
		 LEFT JOIN focus_sessions ON focus_sessions.todo_id = todos.id AND focus_sessions.user_id = todos.user_id
		 WHERE todos.id = ? AND todos.user_id = ? AND todos.deleted_at IS NULL
		 GROUP BY todos.id`,
		todoID,
		userID,
	)
	return scanTodo(row)
}

func (s *Service) ensureHabitsForDate(userID int64, todoDate string) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO todos (user_id, title, todo_date, time_type, start_date, end_date, priority, source_type, habit_id)
		 SELECT user_id, title, ?, 'date_range', ?, ?, 'medium', 'habit', id
		 FROM habits
		 WHERE user_id = ? AND active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`,
		todoDate,
		todoDate,
		todoDate,
		userID,
		todoDate,
		todoDate,
	)
	return err
}

func normalizeDate(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return time.Now().Format("2006-01-02")
	}
	return value
}

func normalizeInput(input TodoInput) (TodoInput, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.Priority = normalizePriority(input.Priority)
	input.TimeType = normalizeTimeType(input.TimeType)
	input.StartDate = normalizeDate(firstNonEmpty(input.StartDate, input.TodoDate))
	input.EndDate = normalizeDate(firstNonEmpty(input.EndDate, input.StartDate))
	if input.EndDate < input.StartDate {
		input.EndDate = input.StartDate
	}
	input.TodoDate = input.StartDate
	input.StartTime = strings.TrimSpace(input.StartTime)
	input.EndTime = strings.TrimSpace(input.EndTime)
	if input.TimeType == timeTypeMoment {
		if input.StartTime == "" {
			return TodoInput{}, ErrInvalidTodo
		}
		if input.EndTime == "" {
			input.EndTime = input.StartTime
		}
		input.EndDate = input.StartDate
	}
	if input.Title == "" || input.Priority == "" {
		return TodoInput{}, ErrInvalidTodo
	}
	return input, nil
}

func normalizeTimeType(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == timeTypeMoment {
		return value
	}
	return timeTypeDateRange
}

func normalizePriority(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == "" {
		return priorityMedium
	}
	if value == priorityLow || value == priorityMedium || value == priorityHigh {
		return value
	}
	return ""
}

func normalizeTodoStatus(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if value == todoStatusAll || value == todoStatusDone {
		return value
	}
	return todoStatusActive
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func nullableText(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func boolToInt(value bool) int {
	if value {
		return 1
	}
	return 0
}

type todoScanner interface {
	Scan(dest ...interface{}) error
}

func scanTodo(scanner todoScanner) (models.Todo, error) {
	var todo models.Todo
	var completed int
	var habitID sql.NullInt64
	err := scanner.Scan(
		&todo.ID,
		&todo.Title,
		&completed,
		&todo.TodoDate,
		&todo.TimeType,
		&todo.StartDate,
		&todo.EndDate,
		&todo.StartTime,
		&todo.EndTime,
		&todo.Priority,
		&todo.SourceType,
		&habitID,
		&todo.FocusSeconds,
		&todo.CreatedAt,
		&todo.UpdatedAt,
	)
	todo.Completed = completed == 1
	if todo.SourceType == "" {
		todo.SourceType = "todo"
	}
	if todo.Priority == "" {
		todo.Priority = priorityMedium
	}
	if todo.TimeType == "" {
		todo.TimeType = timeTypeDateRange
	}
	if todo.StartDate == "" {
		todo.StartDate = todo.TodoDate
	}
	if todo.EndDate == "" {
		todo.EndDate = todo.TodoDate
	}
	if habitID.Valid {
		todo.HabitID = &habitID.Int64
	}
	return todo, err
}
