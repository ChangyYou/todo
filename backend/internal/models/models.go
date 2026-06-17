package models

type User struct {
	ID        int64  `json:"id"`
	Username  string `json:"username"`
	CreatedAt string `json:"createdAt"`
}

type Todo struct {
	ID           int64  `json:"id"`
	Title        string `json:"title"`
	Completed    bool   `json:"completed"`
	TodoDate     string `json:"todoDate"`
	Priority     string `json:"priority"`
	SourceType   string `json:"sourceType"`
	FocusSeconds int64  `json:"focusSeconds"`
	HabitID      *int64 `json:"habitId,omitempty"`
	CreatedAt    string `json:"createdAt"`
	UpdatedAt    string `json:"updatedAt"`
}

type Habit struct {
	ID        int64   `json:"id"`
	Title     string  `json:"title"`
	StartDate string  `json:"startDate"`
	EndDate   *string `json:"endDate,omitempty"`
	Active    bool    `json:"active"`
	CreatedAt string  `json:"createdAt"`
	UpdatedAt string  `json:"updatedAt"`
}

type PomodoroSettings struct {
	FocusMinutes         int    `json:"focusMinutes"`
	ShortBreakMinutes    int    `json:"shortBreakMinutes"`
	LongBreakMinutes     int    `json:"longBreakMinutes"`
	LongBreakInterval    int    `json:"longBreakInterval"`
	AutoStartNextSession bool   `json:"autoStartNextSession"`
	UpdatedAt            string `json:"updatedAt,omitempty"`
}

type FocusSummary struct {
	SessionDate     string `json:"sessionDate"`
	DurationSeconds int64  `json:"durationSeconds"`
}

type FocusStats struct {
	StartDate string            `json:"startDate"`
	EndDate   string            `json:"endDate"`
	Summary   FocusStatsSummary `json:"summary"`
	Daily     []FocusStatsDay   `json:"daily"`
	ByTask    []FocusStatsTask  `json:"byTask"`
	Recent    []FocusStatsEntry `json:"recent"`
}

type FocusStatsSummary struct {
	DurationSeconds int64 `json:"durationSeconds"`
	SessionCount    int64 `json:"sessionCount"`
}

type FocusStatsDay struct {
	Date            string `json:"date"`
	DurationSeconds int64  `json:"durationSeconds"`
	SessionCount    int64  `json:"sessionCount"`
}

type FocusStatsTask struct {
	TodoID          int64  `json:"todoId"`
	Title           string `json:"title"`
	DurationSeconds int64  `json:"durationSeconds"`
	SessionCount    int64  `json:"sessionCount"`
}

type FocusStatsEntry struct {
	TodoID          int64  `json:"todoId"`
	Title           string `json:"title"`
	DurationSeconds int64  `json:"durationSeconds"`
	SessionDate     string `json:"sessionDate"`
	CreatedAt       string `json:"createdAt"`
}
