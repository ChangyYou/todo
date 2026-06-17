package main

import (
	"context"
	"log"
	"os"
	"strings"

	"github.com/cloudwego/hertz/pkg/app"
	"github.com/cloudwego/hertz/pkg/app/server"
	"github.com/cloudwego/hertz/pkg/protocol/consts"

	"todo/backend/internal/auth"
	"todo/backend/internal/db"
	"todo/backend/internal/focus"
	"todo/backend/internal/habits"
	"todo/backend/internal/http/handlers"
	"todo/backend/internal/http/middleware"
	"todo/backend/internal/settings"
	"todo/backend/internal/todos"
)

func main() {
	dataSourceName := os.Getenv("TODO_DATABASE")
	if dataSourceName == "" {
		dataSourceName = "data/todo.db"
	}

	inviteCode := strings.TrimSpace(os.Getenv("TODO_INVITE_CODE"))
	if inviteCode == "" {
		log.Fatal("TODO_INVITE_CODE is required")
	}

	addr := os.Getenv("TODO_ADDR")
	if addr == "" {
		addr = ":8888"
	}

	database, err := db.Open(dataSourceName)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	authService := auth.NewService(database, inviteCode)
	focusService := focus.NewService(database)
	habitService := habits.NewService(database)
	settingsService := settings.NewService(database)
	todoService := todos.NewService(database)
	authHandler := handlers.NewAuthHandler(authService)
	focusHandler := handlers.NewFocusHandler(focusService)
	habitHandler := handlers.NewHabitHandler(habitService)
	settingsHandler := handlers.NewSettingsHandler(settingsService)
	todoHandler := handlers.NewTodoHandler(todoService)

	h := server.Default(server.WithHostPorts(addr))
	h.GET("/ping", func(ctx context.Context, c *app.RequestContext) {
		c.JSON(consts.StatusOK, map[string]string{"message": "pong", "status": "ok"})
	})

	api := h.Group("/api")
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)
	api.POST("/auth/logout", authHandler.Logout)
	api.GET("/auth/me", middleware.RequireUser(authService), authHandler.Me)
	api.GET("/focus-sessions/summary", middleware.RequireUser(authService), focusHandler.Summary)
	api.POST("/focus-sessions", middleware.RequireUser(authService), focusHandler.Create)

	settingsGroup := api.Group("/settings", middleware.RequireUser(authService))
	settingsGroup.GET("/pomodoro", settingsHandler.GetPomodoro)
	settingsGroup.PATCH("/pomodoro", settingsHandler.UpdatePomodoro)

	habitsGroup := api.Group("/habits", middleware.RequireUser(authService))
	habitsGroup.GET("", habitHandler.List)
	habitsGroup.POST("", habitHandler.Create)
	habitsGroup.PATCH("/:id", habitHandler.Update)
	habitsGroup.DELETE("/:id", habitHandler.Delete)

	todosGroup := api.Group("/todos", middleware.RequireUser(authService))
	todosGroup.GET("", todoHandler.List)
	todosGroup.POST("", todoHandler.Create)
	todosGroup.PATCH("/:id", todoHandler.Update)
	todosGroup.DELETE("/:id", todoHandler.Delete)

	log.Printf("todo backend listening on %s", addr)
	h.Spin()
}
