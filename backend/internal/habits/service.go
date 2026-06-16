package habits

import (
	"database/sql"
	"errors"
	"strings"
	"time"

	"todo/backend/internal/models"
)

var ErrInvalidHabit = errors.New("invalid habit")

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) List(userID int64) ([]models.Habit, error) {
	rows, err := s.db.Query(
		`SELECT id, title, start_date, end_date, active, created_at, updated_at
		 FROM habits
		 WHERE user_id = ? AND active = 1
		 ORDER BY id DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.Habit, 0)
	for rows.Next() {
		habit, err := scanHabit(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, habit)
	}

	return result, rows.Err()
}

func (s *Service) Create(userID int64, title, startDate, endDate string) (models.Habit, error) {
	title, startDate, endDate, err := normalizeHabitInput(title, startDate, endDate)
	if err != nil {
		return models.Habit{}, ErrInvalidHabit
	}

	result, err := s.db.Exec(
		`INSERT INTO habits (user_id, title, start_date, end_date) VALUES (?, ?, ?, ?)`,
		userID,
		title,
		startDate,
		nullableString(endDate),
	)
	if err != nil {
		return models.Habit{}, err
	}

	habitID, err := result.LastInsertId()
	if err != nil {
		return models.Habit{}, err
	}

	return s.byID(userID, habitID)
}

func (s *Service) Update(userID, habitID int64, title, startDate, endDate string) (models.Habit, error) {
	title, startDate, endDate, err := normalizeHabitInput(title, startDate, endDate)
	if err != nil {
		return models.Habit{}, ErrInvalidHabit
	}

	_, err = s.db.Exec(
		`UPDATE habits
		 SET title = ?, start_date = ?, end_date = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ? AND active = 1`,
		title,
		startDate,
		nullableString(endDate),
		habitID,
		userID,
	)
	if err != nil {
		return models.Habit{}, err
	}

	habit, err := s.byID(userID, habitID)
	if err != nil {
		return models.Habit{}, err
	}
	if err := s.syncGeneratedTodos(userID, habit); err != nil {
		return models.Habit{}, err
	}

	return habit, nil
}

func (s *Service) Delete(userID, habitID int64) error {
	if _, err := s.db.Exec(
		`UPDATE habits
		 SET active = 0, updated_at = CURRENT_TIMESTAMP
		 WHERE id = ? AND user_id = ?`,
		habitID,
		userID,
	); err != nil {
		return err
	}

	_, err := s.db.Exec(
		`DELETE FROM todos
		 WHERE user_id = ? AND habit_id = ? AND source_type = 'habit' AND todo_date >= ?`,
		userID,
		habitID,
		today(),
	)
	return err
}

func (s *Service) byID(userID, habitID int64) (models.Habit, error) {
	row := s.db.QueryRow(
		`SELECT id, title, start_date, end_date, active, created_at, updated_at
		 FROM habits
		 WHERE id = ? AND user_id = ?`,
		habitID,
		userID,
	)
	return scanHabit(row)
}

func (s *Service) syncGeneratedTodos(userID int64, habit models.Habit) error {
	if _, err := s.db.Exec(
		`UPDATE todos
		 SET title = ?, updated_at = CURRENT_TIMESTAMP
		 WHERE user_id = ? AND habit_id = ? AND source_type = 'habit' AND todo_date >= ?`,
		habit.Title,
		userID,
		habit.ID,
		today(),
	); err != nil {
		return err
	}

	_, err := s.db.Exec(
		`DELETE FROM todos
		 WHERE user_id = ? AND habit_id = ? AND source_type = 'habit' AND todo_date >= ?
		   AND (todo_date < ? OR (? IS NOT NULL AND todo_date > ?))`,
		userID,
		habit.ID,
		today(),
		habit.StartDate,
		nullableStringValue(habit.EndDate),
		nullableStringValue(habit.EndDate),
	)
	return err
}

func normalizeHabitInput(title, startDate, endDate string) (string, string, string, error) {
	title = strings.TrimSpace(title)
	startDate = strings.TrimSpace(startDate)
	endDate = strings.TrimSpace(endDate)
	if title == "" {
		return "", "", "", ErrInvalidHabit
	}
	if startDate == "" {
		startDate = today()
	}
	if !isDate(startDate) {
		return "", "", "", ErrInvalidHabit
	}
	if endDate != "" {
		if !isDate(endDate) || endDate < startDate {
			return "", "", "", ErrInvalidHabit
		}
	}
	return title, startDate, endDate, nil
}

func isDate(value string) bool {
	_, err := time.Parse("2006-01-02", value)
	return err == nil
}

func today() string {
	return time.Now().Format("2006-01-02")
}

func nullableString(value string) interface{} {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func nullableStringValue(value *string) interface{} {
	if value == nil {
		return nil
	}
	return *value
}

type habitScanner interface {
	Scan(dest ...interface{}) error
}

func scanHabit(scanner habitScanner) (models.Habit, error) {
	var habit models.Habit
	var active int
	var endDate sql.NullString
	err := scanner.Scan(
		&habit.ID,
		&habit.Title,
		&habit.StartDate,
		&endDate,
		&active,
		&habit.CreatedAt,
		&habit.UpdatedAt,
	)
	habit.Active = active == 1
	if endDate.Valid {
		habit.EndDate = &endDate.String
	}
	return habit, err
}
