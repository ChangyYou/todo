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
