package focus

import (
	"path/filepath"
	"testing"

	"todo/backend/internal/db"
)

func TestReviewCalendarIncludesSceneFocusSessions(t *testing.T) {
	database, err := db.Open(filepath.Join(t.TempDir(), "todo.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	result, err := database.Exec(`INSERT INTO users (username, password_hash) VALUES (?, ?)`, "tester", "hash")
	if err != nil {
		t.Fatal(err)
	}
	userID, err := result.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}

	result, err = database.Exec(`INSERT INTO focus_scenes (user_id, title) VALUES (?, ?)`, userID, "运动")
	if err != nil {
		t.Fatal(err)
	}
	sceneID, err := result.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}

	if _, err := database.Exec(
		`INSERT INTO focus_sessions (user_id, todo_id, scene_id, duration_seconds, session_date) VALUES (?, ?, ?, ?, ?)`,
		userID,
		0,
		sceneID,
		600,
		"2026-06-17",
	); err != nil {
		t.Fatal(err)
	}

	calendar, err := NewService(database).ReviewCalendar(userID, 2026, 6)
	if err != nil {
		t.Fatal(err)
	}

	var targetDayFound bool
	for _, day := range calendar.Days {
		if day.Date != "2026-06-17" {
			continue
		}
		targetDayFound = true
		if day.FocusSeconds != 600 {
			t.Fatalf("expected focus seconds 600, got %d", day.FocusSeconds)
		}
		if day.SceneCount != 1 {
			t.Fatalf("expected scene count 1, got %d", day.SceneCount)
		}
		if len(day.Entries) != 1 {
			t.Fatalf("expected 1 entry, got %d", len(day.Entries))
		}
		if day.Entries[0].Title != "运动" || day.Entries[0].Type != "scene" {
			t.Fatalf("unexpected entry: %+v", day.Entries[0])
		}
	}
	if !targetDayFound {
		t.Fatal("expected 2026-06-17 in review calendar")
	}
}
