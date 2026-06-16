package middleware

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/auth"
	"todo/backend/internal/http/handlers"
)

func RequireUser(authService *auth.Service) app.HandlerFunc {
	return func(ctx context.Context, c *app.RequestContext) {
		user, err := authService.Authenticate(handlers.SessionToken(c))
		if err != nil {
			c.JSON(consts.StatusUnauthorized, map[string]string{"error": "请先登录"})
			c.Abort()
			return
		}

		handlers.SetCurrentUser(c, user)
		c.Next(ctx)
	}
}
