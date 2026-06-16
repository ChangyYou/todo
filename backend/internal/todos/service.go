package todos

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"todo/backend/internal/models"
)

var ErrInvalidTodo = errors.New("invalid todo")

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) List(userID int64, todoDate string) ([]models.Todo, error) {
	todoDate = normalizeDate(todoDate)
	if err := s.ensureHabitsForDate(userID, todoDate); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(
		`SELECT todos.id,
		        todos.title,
		        todos.completed,
		        todos.todo_date,
		        todos.source_type,
		        todos.habit_id,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS focus_seconds,
		        todos.created_at,
		        todos.updated_at
		 FROM todos
		 LEFT JOIN focus_sessions ON focus_sessions.todo_id = todos.id AND focus_sessions.user_id = todos.user_id
		 WHERE todos.user_id = ? AND todos.todo_date = ?
		 GROUP BY todos.id
		 ORDER BY todos.completed ASC, todos.source_type ASC, todos.id DESC`,
		userID,
		todoDate,
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

func (s *Service) Create(userID int64, title, todoDate string) (models.Todo, error) {
	title = strings.TrimSpace(title)
	todoDate = normalizeDate(todoDate)
	if title == "" {
		return models.Todo{}, ErrInvalidTodo
	}

	result, err := s.db.Exec(
		`INSERT INTO todos (user_id, title, todo_date, source_type) VALUES (?, ?, ?, 'todo')`,
		userID,
		title,
		todoDate,
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

func (s *Service) Update(userID, todoID int64, title *string, completed *bool) (models.Todo, error) {
	if title == nil && completed == nil {
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

	_, err = s.db.Exec(
		`UPDATE todos
		 SET title = ?, completed = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ?`,
		nextTitle,
		boolToInt(nextCompleted),
		todoID,
		userID,
	)
	if err != nil {
		return models.Todo{}, err
	}

	return s.byID(userID, todoID)
}

func (s *Service) Delete(userID, todoID int64) error {
	_, err := s.db.Exec(`DELETE FROM todos WHERE id = ? AND user_id = ?`, todoID, userID)
	return err
}

func (s *Service) byID(userID, todoID int64) (models.Todo, error) {
	row := s.db.QueryRow(
		`SELECT todos.id,
		        todos.title,
		        todos.completed,
		        todos.todo_date,
		        todos.source_type,
		        todos.habit_id,
		        COALESCE(SUM(focus_sessions.duration_seconds), 0) AS focus_seconds,
		        todos.created_at,
		        todos.updated_at
		 FROM todos
		 LEFT JOIN focus_sessions ON focus_sessions.todo_id = todos.id AND focus_sessions.user_id = todos.user_id
		 WHERE todos.id = ? AND todos.user_id = ?
		 GROUP BY todos.id`,
		todoID,
		userID,
	)
	return scanTodo(row)
}

func (s *Service) ensureHabitsForDate(userID int64, todoDate string) error {
	_, err := s.db.Exec(
		`INSERT OR IGNORE INTO todos (user_id, title, todo_date, source_type, habit_id)
		 SELECT user_id, title, ?, 'habit', id
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
	if habitID.Valid {
		todo.HabitID = &habitID.Int64
	}
	return todo, err
}
