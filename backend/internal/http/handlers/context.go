package handlers

import (
	"github.com/cloudwego/hertz/pkg/app"

	"todo/backend/internal/models"
)

const currentUserKey = "currentUser"

func SetCurrentUser(c *app.RequestContext, user models.User) {
	c.Set(currentUserKey, user)
}

func CurrentUser(c *app.RequestContext) (models.User, bool) {
	value, ok := c.Get(currentUserKey)
	if !ok {
		return models.User{}, false
	}

	user, ok := value.(models.User)
	return user, ok
}
