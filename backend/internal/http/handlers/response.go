package handlers

import (
	"context"

	"github.com/cloudwego/hertz/pkg/app"
)

func writeJSON(ctx context.Context, c *app.RequestContext, statusCode int, value interface{}) {
	c.JSON(statusCode, value)
}
