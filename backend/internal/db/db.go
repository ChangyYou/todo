package db

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

func Open(dataSourceName string) (*sql.DB, error) {
	if err := os.MkdirAll(filepath.Dir(dataSourceName), 0o755); err != nil {
		return nil, err
	}

	database, err := sql.Open("sqlite", dataSourceName)
	if err != nil {
		return nil, err
	}

	database.SetMaxOpenConns(1)

	if err := database.Ping(); err != nil {
		database.Close()
		return nil, err
	}

	if err := migrate(database); err != nil {
		database.Close()
		return nil, err
	}

	return database, nil
}

func migrate(database *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			token_hash TEXT NOT NULL UNIQUE,
			expires_at TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS todos (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			completed INTEGER NOT NULL DEFAULT 0,
			todo_date TEXT NOT NULL,
			priority TEXT NOT NULL DEFAULT 'medium',
			source_type TEXT NOT NULL DEFAULT 'todo',
			habit_id INTEGER,
			completed_at TEXT,
			deleted_at TEXT,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS habits (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			title TEXT NOT NULL,
			start_date TEXT NOT NULL,
			end_date TEXT,
			active INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS focus_sessions (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL,
			todo_id INTEGER NOT NULL,
			duration_seconds INTEGER NOT NULL,
			session_date TEXT NOT NULL,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
			FOREIGN KEY (todo_id) REFERENCES todos(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS pomodoro_settings (
			user_id INTEGER PRIMARY KEY,
			focus_minutes INTEGER NOT NULL DEFAULT 25,
			short_break_minutes INTEGER NOT NULL DEFAULT 5,
			long_break_minutes INTEGER NOT NULL DEFAULT 15,
			long_break_interval INTEGER NOT NULL DEFAULT 4,
			auto_start_next_session INTEGER NOT NULL DEFAULT 1,
			created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)`,
		`CREATE INDEX IF NOT EXISTS idx_todos_user_date ON todos(user_id, todo_date)`,
	}

	for _, statement := range statements {
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}

	if err := ensureColumn(database, "todos", "source_type", `ALTER TABLE todos ADD COLUMN source_type TEXT NOT NULL DEFAULT 'todo'`); err != nil {
		return err
	}
	if err := ensureColumn(database, "todos", "habit_id", `ALTER TABLE todos ADD COLUMN habit_id INTEGER`); err != nil {
		return err
	}
	if err := ensureColumn(database, "todos", "priority", `ALTER TABLE todos ADD COLUMN priority TEXT NOT NULL DEFAULT 'medium'`); err != nil {
		return err
	}
	if err := ensureColumn(database, "todos", "deleted_at", `ALTER TABLE todos ADD COLUMN deleted_at TEXT`); err != nil {
		return err
	}
	if err := ensureColumn(database, "todos", "completed_at", `ALTER TABLE todos ADD COLUMN completed_at TEXT`); err != nil {
		return err
	}
	if err := ensureColumn(database, "habits", "end_date", `ALTER TABLE habits ADD COLUMN end_date TEXT`); err != nil {
		return err
	}
	if _, err := database.Exec(`DROP INDEX IF EXISTS idx_todos_user_habit_date`); err != nil {
		return err
	}

	indexStatements := []string{
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_todos_user_habit_date ON todos(user_id, habit_id, todo_date) WHERE habit_id IS NOT NULL AND deleted_at IS NULL`,
		`CREATE INDEX IF NOT EXISTS idx_habits_user_active ON habits(user_id, active)`,
		`CREATE INDEX IF NOT EXISTS idx_focus_sessions_user_date ON focus_sessions(user_id, session_date)`,
		`CREATE INDEX IF NOT EXISTS idx_focus_sessions_todo ON focus_sessions(todo_id)`,
	}

	for _, statement := range indexStatements {
		if _, err := database.Exec(statement); err != nil {
			return err
		}
	}

	return nil
}

func ensureColumn(database *sql.DB, tableName, columnName, statement string) error {
	rows, err := database.Query(`PRAGMA table_info(` + tableName + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var columnType string
		var notNull int
		var defaultValue interface{}
		var primaryKey int

		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			return err
		}
		if name == columnName {
			return rows.Err()
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}

	_, err = database.Exec(statement)
	return err
}
