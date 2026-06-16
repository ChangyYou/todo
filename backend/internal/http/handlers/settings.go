package handlers

import (
	"context"
	"errors"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/models"
	"todo/backend/internal/settings"
)

type SettingsHandler struct {
	settings *settings.Service
}

type updatePomodoroSettingsRequest struct {
	FocusMinutes         int  `json:"focusMinutes"`
	ShortBreakMinutes    int  `json:"shortBreakMinutes"`
	LongBreakMinutes     int  `json:"longBreakMinutes"`
	LongBreakInterval    int  `json:"longBreakInterval"`
	AutoStartNextSession bool `json:"autoStartNextSession"`
}

func NewSettingsHandler(settingsService *settings.Service) *SettingsHandler {
	return &SettingsHandler{settings: settingsService}
}

func (h *SettingsHandler) GetPomodoro(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	result, err := h.settings.GetPomodoro(user.ID)
	if err != nil {
		writePomodoroSettingsError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]models.PomodoroSettings{"settings": result})
}

func (h *SettingsHandler) UpdatePomodoro(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	var request updatePomodoroSettingsRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	result, err := h.settings.UpdatePomodoro(user.ID, models.PomodoroSettings{
		FocusMinutes:         request.FocusMinutes,
		ShortBreakMinutes:    request.ShortBreakMinutes,
		LongBreakMinutes:     request.LongBreakMinutes,
		LongBreakInterval:    request.LongBreakInterval,
		AutoStartNextSession: request.AutoStartNextSession,
	})
	if err != nil {
		writePomodoroSettingsError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]models.PomodoroSettings{"settings": result})
}

func writePomodoroSettingsError(ctx context.Context, c *app.RequestContext, err error) {
	switch {
	case errors.Is(err, settings.ErrInvalidPomodoroSettings):
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "计时设置不正确"})
	default:
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "计时设置暂时不可用"})
	}
}
