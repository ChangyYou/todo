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
	priorityLow    = "low"
	priorityMedium = "medium"
	priorityHigh   = "high"
)

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) List(userID int64, todoDate string) ([]models.Todo, error) {
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

	filterClause := "todos.user_id = ? AND todos.completed = 0 AND todos.deleted_at IS NULL"
	args := []interface{}{userID}
	if todoDate != "" {
		filterClause = "todos.user_id = ? AND todos.todo_date = ? AND todos.deleted_at IS NULL"
		args = append(args, habitDate)
	}

	rows, err := s.db.Query(
		`SELECT todos.id,
		        todos.title,
		        todos.completed,
		        todos.todo_date,
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
		          todos.todo_date ASC,
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

func (s *Service) Create(userID int64, title, todoDate, priority string) (models.Todo, error) {
	title = strings.TrimSpace(title)
	todoDate = normalizeDate(todoDate)
	priority = normalizePriority(priority)
	if title == "" || priority == "" {
		return models.Todo{}, ErrInvalidTodo
	}

	result, err := s.db.Exec(
		`INSERT INTO todos (user_id, title, todo_date, priority, source_type) VALUES (?, ?, ?, ?, 'todo')`,
		userID,
		title,
		todoDate,
		priority,
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

func (s *Service) Update(userID, todoID int64, title *string, completed *bool, todoDate *string, priority *string) (models.Todo, error) {
	if title == nil && completed == nil && todoDate == nil && priority == nil {
		return s.byID(userID, todoID)
	}

	current, err := s.byID(userID, todoID)
	if err != nil {
		return models.Todo{}, err
	}

	nextTitle := current.Title
	if title != nil {
		nextTitle = strings.TrimSpace(*title)
		if nextTitle == "" {
			return models.Todo{}, ErrInvalidTodo
		}
	}

	nextCompleted := current.Completed
	if completed != nil {
		nextCompleted = *completed
	}

	nextTodoDate := current.TodoDate
	if todoDate != nil {
		nextTodoDate = normalizeDate(*todoDate)
	}

	nextPriority := current.Priority
	if priority != nil {
		nextPriority = normalizePriority(*priority)
		if nextPriority == "" {
			return models.Todo{}, ErrInvalidTodo
		}
	}

	_, err = s.db.Exec(
		`UPDATE todos
		 SET title = ?, completed = ?, todo_date = ?, priority = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ?`,
		nextTitle,
		boolToInt(nextCompleted),
		nextTodoDate,
		nextPriority,
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
		`INSERT OR IGNORE INTO todos (user_id, title, todo_date, priority, source_type, habit_id)
		 SELECT user_id, title, ?, 'medium', 'habit', id
		 FROM habits
		 WHERE user_id = ? AND active = 1 AND start_date <= ? AND (end_date IS NULL OR end_date >= ?)`,
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
	if habitID.Valid {
		todo.HabitID = &habitID.Int64
	}
	return todo, err
}
