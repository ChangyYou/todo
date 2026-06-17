package handlers

import (
	"context"
	"errors"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/focus"
)

type FocusHandler struct {
	focus *focus.Service
}

type createFocusSessionRequest struct {
	TodoID          int64  `json:"todoId"`
	DurationSeconds int    `json:"durationSeconds"`
	SessionDate     string `json:"sessionDate"`
}

func NewFocusHandler(focusService *focus.Service) *FocusHandler {
	return &FocusHandler{focus: focusService}
}

func (h *FocusHandler) Summary(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	summary, err := h.focus.SummaryByDate(user.ID, c.Query("date"))
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "专注日期不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "专注统计暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]any{"summary": summary})
}

func (h *FocusHandler) Create(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	var request createFocusSessionRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	err := h.focus.Create(user.ID, request.TodoID, request.DurationSeconds, request.SessionDate)
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "专注记录不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "专注记录暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusCreated, map[string]string{"status": "ok"})
}
