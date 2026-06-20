# Todo Workspace

这是一个前后端分离的 Todo 工作台项目，目前包含番茄钟、Todo、习惯入口、用户登录注册和后端 API。

## 目录结构

- `frontend/`：Vite + React Todo 前端
- `backend/`：CloudWeGo Hertz + SQLite 后端

## Frontend

```bash
cd frontend
npm install
npm run dev
```

## Backend

```bash
cd backend
cp .env.example .env
TODO_INVITE_CODE=dev-code go run ./cmd/server
```

## Deployment

生产环境部署流程见 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。当前项目使用脚本化产物部署：

```bash
./scripts/deploy.sh
```

## Features

- Daily todo management
- Pomodoro focus timer
- Habit launcher
- User registration and login
- SQLite-backed backend API

## Notes

这是个人开源项目，后续会继续补充更多效率工具模块和文档。
