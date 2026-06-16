package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"

	"todo/backend/internal/models"
)

const (
	SessionCookieName = "todo_session"
	SessionMaxAge     = 30 * 24 * 60 * 60
)

var (
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUsernameTaken      = errors.New("username taken")
	ErrUnauthorized       = errors.New("unauthorized")
	ErrInvalidInviteCode  = errors.New("invalid invite code")
)

type Service struct {
	db         *sql.DB
	inviteCode string
}

func NewService(database *sql.DB, inviteCode string) *Service {
	return &Service{
		db:         database,
		inviteCode: strings.TrimSpace(inviteCode),
	}
}

func (s *Service) Register(username, password, inviteCode string) (models.User, string, error) {
	if s.inviteCode == "" || strings.TrimSpace(inviteCode) != s.inviteCode {
		return models.User{}, "", ErrInvalidInviteCode
	}

	username = strings.TrimSpace(username)
	if len(username) < 3 || len(password) < 6 {
		return models.User{}, "", ErrInvalidInput
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return models.User{}, "", err
	}

	result, err := s.db.Exec(
		`INSERT INTO users (username, password_hash) VALUES (?, ?)`,
		username,
		string(passwordHash),
	)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "unique") {
			return models.User{}, "", ErrUsernameTaken
		}
		return models.User{}, "", err
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return models.User{}, "", err
	}

	user, err := s.userByID(userID)
	if err != nil {
		return models.User{}, "", err
	}

	token, err := s.createSession(user.ID)
	if err != nil {
		return models.User{}, "", err
	}

	return user, token, nil
}

func (s *Service) Login(username, password string) (models.User, string, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return models.User{}, "", ErrInvalidCredentials
	}

	var user models.User
	var passwordHash string
	err := s.db.QueryRow(
		`SELECT id, username, password_hash, created_at FROM users WHERE username = ?`,
		username,
	).Scan(&user.ID, &user.Username, &passwordHash, &user.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return models.User{}, "", ErrInvalidCredentials
	}
	if err != nil {
		return models.User{}, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(password)); err != nil {
		return models.User{}, "", ErrInvalidCredentials
	}

	token, err := s.createSession(user.ID)
	if err != nil {
		return models.User{}, "", err
	}

	return user, token, nil
}

func (s *Service) Authenticate(token string) (models.User, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return models.User{}, ErrUnauthorized
	}

	var user models.User
	err := s.db.QueryRow(
		`SELECT users.id, users.username, users.created_at
		 FROM sessions
		 JOIN users ON users.id = sessions.user_id
		 WHERE sessions.token_hash = ? AND sessions.expires_at > CURRENT_TIMESTAMP`,
		hashToken(token),
	).Scan(&user.ID, &user.Username, &user.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return models.User{}, ErrUnauthorized
	}
	if err != nil {
		return models.User{}, err
	}

	return user, nil
}

func (s *Service) Logout(token string) error {
	if strings.TrimSpace(token) == "" {
		return nil
	}

	_, err := s.db.Exec(`DELETE FROM sessions WHERE token_hash = ?`, hashToken(token))
	return err
}

func (s *Service) userByID(userID int64) (models.User, error) {
	var user models.User
	err := s.db.QueryRow(
		`SELECT id, username, created_at FROM users WHERE id = ?`,
		userID,
	).Scan(&user.ID, &user.Username, &user.CreatedAt)
	return user, err
}

func (s *Service) createSession(userID int64) (string, error) {
	token, err := randomToken()
	if err != nil {
		return "", err
	}

	expiresAt := time.Now().UTC().Add(time.Duration(SessionMaxAge) * time.Second).Format("2006-01-02 15:04:05")
	_, err = s.db.Exec(
		`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES (?, ?, ?)`,
		userID,
		hashToken(token),
		expiresAt,
	)
	if err != nil {
		return "", err
	}

	return token, nil
}

func randomToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}
	return hex.EncodeToString(buffer), nil
}

func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}
