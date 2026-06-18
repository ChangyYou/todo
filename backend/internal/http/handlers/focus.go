package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/focus"
)

type FocusHandler struct {
	focus *focus.Service
}

type createFocusSessionRequest struct {
	TodoID          int64  `json:"todoId"`
	SceneID         int64  `json:"sceneId"`
	DurationSeconds int    `json:"durationSeconds"`
	SessionDate     string `json:"sessionDate"`
}

type updateFocusSessionRequest struct {
	Title       *string `json:"title"`
	SceneID     *int64  `json:"sceneId"`
	SessionDate string  `json:"sessionDate"`
	StartTime   string  `json:"startTime"`
	EndTime     string  `json:"endTime"`
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

func (h *FocusHandler) Stats(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	stats, err := h.focus.Stats(user.ID, c.Query("start"), c.Query("end"), c.Query("period"))
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "统计日期不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "专注统计暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]any{"stats": stats})
}

func (h *FocusHandler) ReviewCalendar(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	year, err := parseOptionalInt(c.Query("year"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "复盘年份不正确"})
		return
	}
	month, err := parseOptionalInt(c.Query("month"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "复盘月份不正确"})
		return
	}
	if string(c.Query("view")) == "week" {
		week, err := h.focus.ReviewWeek(user.ID, year, month, string(c.Query("date")))
		if errors.Is(err, focus.ErrInvalidFocusSession) {
			writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "复盘日期不正确"})
			return
		}
		if err != nil {
			writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "个人复盘暂时不可用"})
			return
		}
		writeJSON(ctx, c, consts.StatusOK, map[string]any{"week": week})
		return
	}

	calendar, err := h.focus.ReviewCalendar(user.ID, year, month)
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "复盘日期不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "个人复盘暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]any{"calendar": calendar})
}

func (h *FocusHandler) DeleteReviewTodo(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	todoID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || todoID <= 0 {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "任务 ID 不正确"})
		return
	}

	err = h.focus.DeleteReviewTodo(user.ID, todoID)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(ctx, c, consts.StatusNotFound, map[string]string{"error": "任务不存在"})
		return
	}
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "任务 ID 不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "永久删除任务失败"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func (h *FocusHandler) Create(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	var request createFocusSessionRequest
	if err := c.BindAndValidate(&request); err != nil {
		if jsonErr := json.Unmarshal(c.Request.Body(), &request); jsonErr != nil {
			writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
			return
		}
	}

	err := h.focus.Create(user.ID, request.TodoID, request.SceneID, request.DurationSeconds, request.SessionDate)
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

func (h *FocusHandler) UpdateSession(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	sessionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || sessionID <= 0 {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "专注记录 ID 不正确"})
		return
	}

	var request updateFocusSessionRequest
	if err := c.BindAndValidate(&request); err != nil {
		if jsonErr := json.Unmarshal(c.Request.Body(), &request); jsonErr != nil {
			writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
			return
		}
	}

	err = h.focus.UpdateSession(user.ID, sessionID, focus.FocusSessionPatch{
		Title:       request.Title,
		SceneID:     request.SceneID,
		SessionDate: request.SessionDate,
		StartTime:   request.StartTime,
		EndTime:     request.EndTime,
	})
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(ctx, c, consts.StatusNotFound, map[string]string{"error": "专注记录不存在"})
		return
	}
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "专注记录不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "专注记录暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func (h *FocusHandler) DeleteSession(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	sessionID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil || sessionID <= 0 {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "专注记录 ID 不正确"})
		return
	}

	err = h.focus.DeleteSession(user.ID, sessionID)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(ctx, c, consts.StatusNotFound, map[string]string{"error": "专注记录不存在"})
		return
	}
	if errors.Is(err, focus.ErrInvalidFocusSession) {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "专注记录 ID 不正确"})
		return
	}
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "删除专注记录失败"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func parseOptionalInt(value string) (int, error) {
	if value == "" {
		return 0, nil
	}
	result, err := strconv.Atoi(value)
	if err != nil || result < 0 {
		return 0, errors.New("invalid number")
	}
	return result, nil
}
