package handlers

import (
	"context"
	"database/sql"
	"errors"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/models"
	"todo/backend/internal/todos"
)

type TodoHandler struct {
	todos *todos.Service
}

type createTodoRequest struct {
	Title    string `json:"title"`
	TodoDate string `json:"todoDate"`
	Priority string `json:"priority"`
}

type updateTodoRequest struct {
	Title     *string `json:"title"`
	Completed *bool   `json:"completed"`
	TodoDate  *string `json:"todoDate"`
	Priority  *string `json:"priority"`
}

func NewTodoHandler(todoService *todos.Service) *TodoHandler {
	return &TodoHandler{todos: todoService}
}

func (h *TodoHandler) List(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	result, err := h.todos.List(user.ID, string(c.Query("date")))
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "任务列表暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string][]models.Todo{"todos": result})
}

func (h *TodoHandler) Create(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	var request createTodoRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	todo, err := h.todos.Create(user.ID, request.Title, request.TodoDate, request.Priority)
	if err != nil {
		writeTodoError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusCreated, map[string]models.Todo{"todo": todo})
}

func (h *TodoHandler) Update(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	todoID, err := parseTodoID(c.Param("id"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "任务 ID 不正确"})
		return
	}

	var request updateTodoRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	todo, err := h.todos.Update(user.ID, todoID, request.Title, request.Completed, request.TodoDate, request.Priority)
	if err != nil {
		writeTodoError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]models.Todo{"todo": todo})
}

func (h *TodoHandler) Delete(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	todoID, err := parseTodoID(c.Param("id"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "任务 ID 不正确"})
		return
	}

	if err := h.todos.Delete(user.ID, todoID); err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "删除任务失败"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func parseTodoID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid todo id")
	}
	return id, nil
}

func writeTodoError(ctx context.Context, c *app.RequestContext, err error) {
	switch {
	case errors.Is(err, todos.ErrInvalidTodo):
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "任务内容不能为空"})
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(ctx, c, consts.StatusNotFound, map[string]string{"error": "任务不存在"})
	default:
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "任务服务暂时不可用"})
	}
}
