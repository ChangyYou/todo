# Todo Backend

Go backend for the Todo app, built with CloudWeGo Hertz, SQLite, cookie sessions, and invite-code registration.

## Architecture

```text
cmd/server/main.go
  Hertz server bootstrap and route registration

internal/http/handlers
  HTTP request binding, response writing, and status-code mapping

internal/http/middleware
  Request middleware, currently login authentication

internal/auth
  Registration, login, logout, password hashing, and session management

internal/todos
  Todo CRUD business logic scoped by user

internal/db
  SQLite connection and schema migration

internal/models
  JSON-facing data structures
```

## Environment

```bash
TODO_ADDR=:8888
TODO_DATABASE=/var/lib/todo/todo.db
TODO_INVITE_CODE=change-me
TODO_COOKIE_SECURE=true
```

`TODO_INVITE_CODE` is required. The server exits during startup if it is missing.

## Local Run

```bash
cd backend
TODO_ADDR=:8899 \
TODO_DATABASE=/tmp/todo-dev.db \
TODO_INVITE_CODE=dev-code \
TODO_COOKIE_SECURE=false \
go run ./cmd/server
```

## Routes

```text
GET    /ping
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/todos?date=YYYY-MM-DD
POST   /api/todos
PATCH  /api/todos/:id
DELETE /api/todos/:id
```
