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

### Deploy

`todo.youchangblog.cn` 计划由 Nginx 托管，站点目录是 `/var/www/todo/dist`。

注意：DNS 解析到服务器后，还需要 Nginx 配置包含 `server_name todo.youchangblog.cn;`，并把 `root` 指向 `/var/www/todo/dist`。

每次修改前端代码后，如果希望线上域名看到最新版，需要重新构建并部署：

```bash
cd frontend
npm run deploy
```

这个命令会先执行 `npm run build`，再把新的 `dist/` 同步到 Todo 站点目录。

## Backend

```bash
cd backend
go run ./cmd/server
```

## 说明

这是个人开源项目，后续会继续补充更多效率工具模块和部署文档。

## Backend verification note

如果当前环境无法联网拉取 Go 依赖，则后端目录只保证骨架结构正确，实际 `go run` 需要在可下载 Hertz 依赖的环境中完成。
