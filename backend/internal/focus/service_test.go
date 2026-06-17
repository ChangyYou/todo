package focus

import (
	"errors"
	"path/filepath"
	"testing"

	"todo/backend/internal/db"
)

func TestCreateAllowsUnboundFocusSession(t *testing.T) {
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

	service := NewService(database)
	if err := service.Create(userID, 0, 0, 5, "2026-06-17"); !errors.Is(err, ErrInvalidFocusSession) {
		t.Fatalf("expected five-second session to be rejected, got %v", err)
	}
	if err := service.Create(userID, 0, 0, 6, "2026-06-17"); err != nil {
		t.Fatal(err)
	}

	summary, err := service.SummaryByDate(userID, "2026-06-17")
	if err != nil {
		t.Fatal(err)
	}
	if summary.DurationSeconds != 6 {
		t.Fatalf("unexpected summary: %+v", summary)
	}
	var sessionCount int
	if err := database.QueryRow(`SELECT COUNT(*) FROM focus_sessions WHERE user_id = ?`, userID).Scan(&sessionCount); err != nil {
		t.Fatal(err)
	}
	if sessionCount != 1 {
		t.Fatalf("expected one focus session, got %d", sessionCount)
	}
}

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

	result, err = database.Exec(`INSERT INTO focus_scenes (user_id, title, color) VALUES (?, ?, ?)`, userID, "运动", "#6f9fc7")
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
		nil,
		300,
		"2026-06-17",
	); err != nil {
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

	result, err = database.Exec(
		`INSERT INTO todos (user_id, title, todo_date, priority) VALUES (?, ?, ?, ?)`,
		userID,
		"阅读 Go 后端",
		"2026-06-17",
		"medium",
	)
	if err != nil {
		t.Fatal(err)
	}
	todoID, err := result.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}

	if _, err := database.Exec(
		`INSERT INTO focus_sessions (user_id, todo_id, scene_id, duration_seconds, session_date) VALUES (?, ?, ?, ?, ?)`,
		userID,
		todoID,
		sceneID,
		900,
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
		if day.FocusSeconds != 1800 {
			t.Fatalf("expected focus seconds 1800, got %d", day.FocusSeconds)
		}
		if day.SceneCount != 1 {
			t.Fatalf("expected scene count 1, got %d", day.SceneCount)
		}
		if len(day.Entries) != 2 {
			t.Fatalf("expected 2 entries, got %d", len(day.Entries))
		}
		if day.Entries[0].Title != "阅读 Go 后端" || day.Entries[0].Type != "focus" {
			t.Fatalf("unexpected first entry: %+v", day.Entries[0])
		}
		if day.Entries[0].SceneTitle != "运动" || day.Entries[0].SceneColor != "#6f9fc7" {
			t.Fatalf("expected scene metadata on focus entry, got %+v", day.Entries[0])
		}
		if len(day.Tasks) != 2 {
			t.Fatalf("expected 2 review task rows, got %d", len(day.Tasks))
		}
		var taskFound bool
		for _, task := range day.Tasks {
			if task.TodoID != todoID {
				continue
			}
			taskFound = true
			if task.SceneTitle != "运动" || task.SceneColor != "#6f9fc7" {
				t.Fatalf("expected task scene metadata, got %+v", task)
			}
		}
		if !taskFound {
			t.Fatal("expected todo task in review detail")
		}
	}
	if !targetDayFound {
		t.Fatal("expected 2026-06-17 in review calendar")
	}
}

func TestStatsIncludesSceneDistribution(t *testing.T) {
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

	result, err = database.Exec(`INSERT INTO focus_scenes (user_id, title, color) VALUES (?, ?, ?)`, userID, "运动", "#6f9fc7")
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
	if _, err := database.Exec(
		`INSERT INTO focus_sessions (user_id, todo_id, scene_id, duration_seconds, session_date) VALUES (?, ?, ?, ?, ?)`,
		userID,
		0,
		nil,
		300,
		"2026-06-17",
	); err != nil {
		t.Fatal(err)
	}

	stats, err := NewService(database).Stats(userID, "2026-06-11", "2026-06-17", "day")
	if err != nil {
		t.Fatal(err)
	}

	if len(stats.ScenePeriods) != 7 {
		t.Fatalf("expected 7 scene periods, got %d", len(stats.ScenePeriods))
	}
	today := stats.ScenePeriods[len(stats.ScenePeriods)-1]
	if today.DurationSeconds != 900 {
		t.Fatalf("expected scene period duration 900, got %d", today.DurationSeconds)
	}
	if len(today.Scenes) != 2 {
		t.Fatalf("expected two scene slices, got %+v", today.Scenes)
	}
	if today.Scenes[0].Title != "运动" || today.Scenes[0].Color != "#6f9fc7" || today.Scenes[0].DurationSeconds != 600 || today.Scenes[0].Percentage != 67 {
		t.Fatalf("unexpected first scene slice: %+v", today.Scenes[0])
	}
	if today.Scenes[1].Title != "默认场景" || today.Scenes[1].SceneID != 0 || today.Scenes[1].DurationSeconds != 300 || today.Scenes[1].Percentage != 33 {
		t.Fatalf("unexpected default scene slice: %+v", today.Scenes[1])
	}
}

func TestReviewCalendarDoesNotDuplicateCompletedFocusedTodoEntry(t *testing.T) {
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

	result, err = database.Exec(
		`INSERT INTO todos (user_id, title, completed, todo_date, priority, completed_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
		userID,
		"是",
		1,
		"2026-06-17",
		"medium",
	)
	if err != nil {
		t.Fatal(err)
	}
	todoID, err := result.LastInsertId()
	if err != nil {
		t.Fatal(err)
	}

	if _, err := database.Exec(
		`INSERT INTO focus_sessions (user_id, todo_id, duration_seconds, session_date) VALUES (?, ?, ?, ?)`,
		userID,
		todoID,
		60,
		"2026-06-17",
	); err != nil {
		t.Fatal(err)
	}

	calendar, err := NewService(database).ReviewCalendar(userID, 2026, 6)
	if err != nil {
		t.Fatal(err)
	}

	for _, day := range calendar.Days {
		if day.Date != "2026-06-17" {
			continue
		}
		if day.FocusSeconds != 60 {
			t.Fatalf("expected focus seconds 60, got %d", day.FocusSeconds)
		}
		if len(day.Entries) != 1 {
			t.Fatalf("expected one calendar entry for completed focused todo, got %+v", day.Entries)
		}
		if day.Entries[0].TodoID != todoID || day.Entries[0].Title != "是" || day.Entries[0].Meta != "完成" {
			t.Fatalf("unexpected calendar entry: %+v", day.Entries[0])
		}
		if len(day.Tasks) != 1 || day.Tasks[0].FocusSeconds != 60 {
			t.Fatalf("expected detail task with focus seconds, got %+v", day.Tasks)
		}
		return
	}

	t.Fatal("expected 2026-06-17 in review calendar")
}
