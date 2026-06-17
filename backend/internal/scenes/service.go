package scenes

import (
	"database/sql"
	"errors"
	"strings"

	"todo/backend/internal/models"
)

var ErrInvalidScene = errors.New("invalid focus scene")

type Service struct {
	db *sql.DB
}

func NewService(database *sql.DB) *Service {
	return &Service{db: database}
}

func (s *Service) List(userID int64) ([]models.FocusScene, error) {
	rows, err := s.db.Query(
		`SELECT id, title, active, created_at, updated_at
		   FROM focus_scenes
		  WHERE user_id = ? AND active = 1
		  ORDER BY id DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]models.FocusScene, 0)
	for rows.Next() {
		scene, err := scanScene(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, scene)
	}

	return result, rows.Err()
}

func (s *Service) Create(userID int64, title string) (models.FocusScene, error) {
	title = strings.TrimSpace(title)
	if userID <= 0 || title == "" {
		return models.FocusScene{}, ErrInvalidScene
	}

	result, err := s.db.Exec(
		`INSERT INTO focus_scenes (user_id, title) VALUES (?, ?)`,
		userID,
		title,
	)
	if err != nil {
		return models.FocusScene{}, err
	}

	sceneID, err := result.LastInsertId()
	if err != nil {
		return models.FocusScene{}, err
	}

	return s.byID(userID, sceneID)
}

func (s *Service) Update(userID, sceneID int64, title string) (models.FocusScene, error) {
	title = strings.TrimSpace(title)
	if userID <= 0 || sceneID <= 0 || title == "" {
		return models.FocusScene{}, ErrInvalidScene
	}

	_, err := s.db.Exec(
		`UPDATE focus_scenes
		    SET title = ?, updated_at = CURRENT_TIMESTAMP
		  WHERE id = ? AND user_id = ? AND active = 1`,
		title,
		sceneID,
		userID,
	)
	if err != nil {
		return models.FocusScene{}, err
	}

	return s.byID(userID, sceneID)
}

func (s *Service) Delete(userID, sceneID int64) error {
	if userID <= 0 || sceneID <= 0 {
		return ErrInvalidScene
	}
	_, err := s.db.Exec(
		`UPDATE focus_scenes
		    SET active = 0, updated_at = CURRENT_TIMESTAMP
		  WHERE id = ? AND user_id = ?`,
		sceneID,
		userID,
	)
	return err
}

func (s *Service) byID(userID, sceneID int64) (models.FocusScene, error) {
	row := s.db.QueryRow(
		`SELECT id, title, active, created_at, updated_at
		   FROM focus_scenes
		  WHERE id = ? AND user_id = ?`,
		sceneID,
		userID,
	)
	return scanScene(row)
}

type sceneScanner interface {
	Scan(dest ...interface{}) error
}

func scanScene(scanner sceneScanner) (models.FocusScene, error) {
	var scene models.FocusScene
	var active int
	err := scanner.Scan(
		&scene.ID,
		&scene.Title,
		&active,
		&scene.CreatedAt,
		&scene.UpdatedAt,
	)
	scene.Active = active == 1
	return scene, err
}
