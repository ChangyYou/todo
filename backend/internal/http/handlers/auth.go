package handlers

import (
	"context"
	"errors"
	"os"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/auth"
	"todo/backend/internal/models"
)

type AuthHandler struct {
	auth *auth.Service
}

type credentialsRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	InviteCode string `json:"inviteCode"`
}

func NewAuthHandler(authService *auth.Service) *AuthHandler {
	return &AuthHandler{auth: authService}
}

func (h *AuthHandler) Register(ctx context.Context, c *app.RequestContext) {
	var request credentialsRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	user, token, err := h.auth.Register(request.Username, request.Password, request.InviteCode)
	if err != nil {
		writeAuthError(ctx, c, err)
		return
	}

	setSessionCookie(c, token)
	writeJSON(ctx, c, consts.StatusCreated, map[string]models.User{"user": user})
}

func (h *AuthHandler) Login(ctx context.Context, c *app.RequestContext) {
	var request credentialsRequest
	if err := c.BindAndValidate(&request); err != nil {
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "请求格式不正确"})
		return
	}

	user, token, err := h.auth.Login(request.Username, request.Password)
	if err != nil {
		writeAuthError(ctx, c, err)
		return
	}

	setSessionCookie(c, token)
	writeJSON(ctx, c, consts.StatusOK, map[string]models.User{"user": user})
}

func (h *AuthHandler) Logout(ctx context.Context, c *app.RequestContext) {
	_ = h.auth.Logout(SessionToken(c))
	clearSessionCookie(c)
	writeJSON(ctx, c, consts.StatusOK, map[string]string{"status": "ok"})
}

func (h *AuthHandler) Me(ctx context.Context, c *app.RequestContext) {
	user, ok := CurrentUser(c)
	if !ok {
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
		return
	}

	writeJSON(ctx, c, consts.StatusOK, map[string]models.User{"user": user})
}

func SessionToken(c *app.RequestContext) string {
	return string(c.Cookie(auth.SessionCookieName))
}

func setSessionCookie(c *app.RequestContext, token string) {
	c.SetCookie(
		auth.SessionCookieName,
		token,
		auth.SessionMaxAge,
		"/",
		"",
		protocol.CookieSameSiteLaxMode,
		isSecureCookie(),
		true,
	)
}

func clearSessionCookie(c *app.RequestContext) {
	c.SetCookie(
		auth.SessionCookieName,
		"",
		-1,
		"/",
		"",
		protocol.CookieSameSiteLaxMode,
		isSecureCookie(),
		true,
	)
}

func isSecureCookie() bool {
	return os.Getenv("TODO_COOKIE_SECURE") == "true"
}

func writeAuthError(ctx context.Context, c *app.RequestContext, err error) {
	switch {
	case errors.Is(err, auth.ErrInvalidInput):
		writeJSON(ctx, c, consts.StatusBadRequest, map[string]string{"error": "用户名至少 3 位，密码至少 6 位"})
	case errors.Is(err, auth.ErrUsernameTaken):
		writeJSON(ctx, c, consts.StatusConflict, map[string]string{"error": "用户名已存在"})
	case errors.Is(err, auth.ErrInvalidCredentials):
		writeJSON(ctx, c, consts.StatusUnauthorized, map[string]string{"error": "用户名或密码不正确"})
	case errors.Is(err, auth.ErrInvalidInviteCode):
		writeJSON(ctx, c, consts.StatusForbidden, map[string]string{"error": "邀请码不正确"})
	default:
		writeJSON(ctx, c, consts.StatusInternalServerError, map[string]string{"error": "认证服务暂时不可用"})
	}
}
