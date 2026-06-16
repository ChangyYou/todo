package handlers

import (
	"context"
	"database/sql"
	"errors"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/habits"
	"todo/backend/internal/models"
)

type HabitHandler struct {
	habits *habits.Service
}

type createHabitRequest struct {
	Title     string `json:"title"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

type updateHabitRequest struct {
	Title     string `json:"title"`
	StartDate string `json:"startDate"`
	EndDate   string `json:"endDate"`
}

func NewHabitHandler(habitService *habits.Service) *HabitHandler {
	return &HabitHandler{habits: habitService}
}

func (h *HabitHandler) List(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	result, err := h.habits.List(user.ID)
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "习惯列表暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string][]models.Habit{"habits": result})
}

func (h *HabitHandler) Create(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	var request createHabitRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	habit, err := h.habits.Create(user.ID, request.Title, request.StartDate, request.EndDate)
	if err != nil {
		writeHabitError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusCreated, map[string]models.Habit{"habit": habit})
}

func (h *HabitHandler) Update(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	habitID, err := parseHabitID(c.Param("id"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "习惯 ID 不正确"})
		return
	}

	var request updateHabitRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	habit, err := h.habits.Update(user.ID, habitID, request.Title, request.StartDate, request.EndDate)
	if err != nil {
		writeHabitError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]models.Habit{"habit": habit})
}

func (h *HabitHandler) Delete(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	habitID, err := parseHabitID(c.Param("id"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "习惯 ID 不正确"})
		return
	}

	if err := h.habits.Delete(user.ID, habitID); err != nil {
		writeHabitError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func parseHabitID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid habit id")
	}
	return id, nil
}

func writeHabitError(ctx context.Context, c *app.RequestContext, err error) {
	switch {
	case errors.Is(err, habits.ErrInvalidHabit):
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "习惯内容不能为空"})
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(ctx, c, consts.StatusNotFound, map[string]string{"error": "习惯不存在"})
	default:
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "习惯服务暂时不可用"})
	}
}
