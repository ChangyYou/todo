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
	TimeType     string `json:"timeType"`
	StartDate    string `json:"startDate"`
	EndDate      string `json:"endDate"`
	StartTime    string `json:"startTime,omitempty"`
	EndTime      string `json:"endTime,omitempty"`
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

type FocusScene struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Color     string `json:"color"`
	Active    bool   `json:"active"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
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
	StartDate    string                  `json:"startDate"`
	EndDate      string                  `json:"endDate"`
	Period       string                  `json:"period"`
	Overview     FocusStatsOverview      `json:"overview"`
	Summary      FocusStatsSummary       `json:"summary"`
	Periods      []FocusStatsPeriod      `json:"periods"`
	ScenePeriods []FocusStatsScenePeriod `json:"scenePeriods"`
	HabitWeek    []FocusStatsHabitDay    `json:"habitWeek"`
	Daily        []FocusStatsDay         `json:"daily"`
	ByTask       []FocusStatsTask        `json:"byTask"`
	Recent       []FocusStatsEntry       `json:"recent"`
}

type FocusStatsSummary struct {
	DurationSeconds int64 `json:"durationSeconds"`
	SessionCount    int64 `json:"sessionCount"`
}

type FocusStatsOverview struct {
	TodayCompletedTasks int64 `json:"todayCompletedTasks"`
	TodayPomodoros      int64 `json:"todayPomodoros"`
	TodayFocusSeconds   int64 `json:"todayFocusSeconds"`
	TotalCompletedTasks int64 `json:"totalCompletedTasks"`
	TotalPomodoros      int64 `json:"totalPomodoros"`
	TotalFocusSeconds   int64 `json:"totalFocusSeconds"`
}

type FocusStatsPeriod struct {
	Label              string `json:"label"`
	StartDate          string `json:"startDate"`
	EndDate            string `json:"endDate"`
	DurationSeconds    int64  `json:"durationSeconds"`
	SessionCount       int64  `json:"sessionCount"`
	TaskTotal          int64  `json:"taskTotal"`
	TaskCompleted      int64  `json:"taskCompleted"`
	TaskCompletionRate int64  `json:"taskCompletionRate"`
}

type FocusStatsScenePeriod struct {
	Label           string                 `json:"label"`
	StartDate       string                 `json:"startDate"`
	EndDate         string                 `json:"endDate"`
	DurationSeconds int64                  `json:"durationSeconds"`
	Scenes          []FocusStatsSceneSlice `json:"scenes"`
}

type FocusStatsSceneSlice struct {
	SceneID         int64  `json:"sceneId"`
	Title           string `json:"title"`
	Color           string `json:"color"`
	DurationSeconds int64  `json:"durationSeconds"`
	SessionCount    int64  `json:"sessionCount"`
	Percentage      int64  `json:"percentage"`
}

type FocusStatsHabitDay struct {
	Date            string   `json:"date"`
	Label           string   `json:"label"`
	Total           int64    `json:"total"`
	Checked         int64    `json:"checked"`
	Completion      int64    `json:"completion"`
	CompletedHabits []string `json:"completedHabits"`
	PendingHabits   []string `json:"pendingHabits"`
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

type ReviewCalendar struct {
	Year  int                 `json:"year"`
	Month int                 `json:"month"`
	Days  []ReviewCalendarDay `json:"days"`
}

type ReviewWeek struct {
	StartDate string          `json:"startDate"`
	EndDate   string          `json:"endDate"`
	Days      []ReviewWeekDay `json:"days"`
}

type ReviewWeekDay struct {
	Date    string            `json:"date"`
	Day     int               `json:"day"`
	Label   string            `json:"label"`
	IsToday bool              `json:"isToday"`
	Events  []ReviewWeekEvent `json:"events"`
}

type ReviewWeekEvent struct {
	ID              int64  `json:"id"`
	TodoID          int64  `json:"todoId,omitempty"`
	SceneID         int64  `json:"sceneId,omitempty"`
	Type            string `json:"type"`
	Title           string `json:"title"`
	StartTime       string `json:"startTime"`
	EndTime         string `json:"endTime"`
	SessionDate     string `json:"sessionDate,omitempty"`
	DurationSeconds int64  `json:"durationSeconds,omitempty"`
	Meta            string `json:"meta,omitempty"`
	Color           string `json:"color,omitempty"`
}

type ReviewCalendarDay struct {
	Date            string                `json:"date"`
	Day             int                   `json:"day"`
	InCurrentMonth  bool                  `json:"inCurrentMonth"`
	IsToday         bool                  `json:"isToday"`
	CompletedTasks  int64                 `json:"completedTasks"`
	CompletedHabits int64                 `json:"completedHabits"`
	SceneCount      int64                 `json:"sceneCount"`
	FocusSeconds    int64                 `json:"focusSeconds"`
	Entries         []ReviewCalendarEntry `json:"entries"`
	Tasks           []ReviewTaskStat      `json:"tasks"`
}

type ReviewCalendarEntry struct {
	TodoID     int64  `json:"todoId,omitempty"`
	SceneID    int64  `json:"sceneId,omitempty"`
	Type       string `json:"type"`
	Title      string `json:"title"`
	Meta       string `json:"meta,omitempty"`
	SceneTitle string `json:"sceneTitle,omitempty"`
	SceneColor string `json:"sceneColor,omitempty"`
}

type ReviewTaskStat struct {
	TodoID       int64  `json:"todoId"`
	SceneID      int64  `json:"sceneId,omitempty"`
	Title        string `json:"title"`
	SourceType   string `json:"sourceType"`
	Completed    bool   `json:"completed"`
	FocusSeconds int64  `json:"focusSeconds"`
	SessionCount int64  `json:"sessionCount"`
	CompletedAt  string `json:"completedAt,omitempty"`
	SceneTitle   string `json:"sceneTitle,omitempty"`
	SceneColor   string `json:"sceneColor,omitempty"`
}
