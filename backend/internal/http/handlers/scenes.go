package handlers

import (
	"context"
	"database/sql"
	"errors"
	"strconv"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/models"
	"todo/backend/internal/scenes"
)

type SceneHandler struct {
	scenes *scenes.Service
}

type sceneRequest struct {
	Title string `json:"title"`
	Color string `json:"color"`
}

func NewSceneHandler(sceneService *scenes.Service) *SceneHandler {
	return &SceneHandler{scenes: sceneService}
}

func (h *SceneHandler) List(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	result, err := h.scenes.List(user.ID)
	if err != nil {
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "场景列表暂时不可用"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string][]models.FocusScene{"scenes": result})
}

func (h *SceneHandler) Create(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	var request sceneRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	scene, err := h.scenes.Create(user.ID, request.Title, request.Color)
	if err != nil {
		writeSceneError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusCreated, map[string]models.FocusScene{"scene": scene})
}

func (h *SceneHandler) Update(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	sceneID, err := parseSceneID(c.Param("id"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "场景 ID 不正确"})
		return
	}

	var request sceneRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	scene, err := h.scenes.Update(user.ID, sceneID, request.Title, request.Color)
	if err != nil {
		writeSceneError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]models.FocusScene{"scene": scene})
}

func (h *SceneHandler) Delete(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	sceneID, err := parseSceneID(c.Param("id"))
	if err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "场景 ID 不正确"})
		return
	}

	if err := h.scenes.Delete(user.ID, sceneID); err != nil {
		writeSceneError(ctx, c, err)
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func parseSceneID(value string) (int64, error) {
	id, err := strconv.ParseInt(value, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("invalid scene id")
	}
	return id, nil
}

func writeSceneError(ctx context.Context, c *app.RequestContext, err error) {
	switch {
	case errors.Is(err, scenes.ErrInvalidScene):
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "场景名称不能为空"})
	case errors.Is(err, sql.ErrNoRows):
		writeJSON(ctx, c, consts.StatusNotFound, map[string]string{"error": "场景不存在"})
	default:
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "场景服务暂时不可用"})
	}
}
