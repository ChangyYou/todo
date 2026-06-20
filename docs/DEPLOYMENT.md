# Deployment

This project follows a production-style flow:

1. Develop locally.
2. Commit changes to Git.
3. Let CI verify frontend and backend checks.
4. Deploy immutable build output to the server.
5. Restart the backend service and run health checks.

The server should not be edited by hand for normal feature work. It should only run reviewed build output.

## Current Production Layout

```text
Host: root@8.160.182.56
Site: https://todo.youchangblog.cn/

Frontend dist: /var/www/todo/dist
Backend binary: /opt/todo/todo-server
Backend service: todo-backend.service
SQLite database: /var/lib/todo/todo.db
API upstream: http://127.0.0.1:8888
```

Nginx serves the frontend and proxies `/api/` to the backend service.

## Release Command

From a clean local Git working tree:

```bash
./scripts/deploy.sh
```

The script:

- runs local frontend checks: `npm ci`, `npm test`, `npm run build`
- runs local backend checks: `go test ./...`
- builds a Linux backend binary locally
- uploads frontend and backend artifacts to `/tmp/todo-deploy`
- backs up the existing binary and frontend dist
- replaces production artifacts
- restarts `todo-backend.service`
- checks backend and public site health
- rolls back artifacts if the remote deploy fails

## Configuration

The deploy script is controlled with environment variables:

```bash
DEPLOY_HOST=root@8.160.182.56
REMOTE_APP_DIR=/opt/todo
REMOTE_WEB_DIR=/var/www/todo/dist
REMOTE_BACKUP_DIR=/var/backups/todo
SERVICE_NAME=todo-backend.service
REMOTE_HEALTH_URL=http://127.0.0.1:8888/ping
PUBLIC_HEALTH_URL=https://todo.youchangblog.cn/
```

For emergency use only, you can override these guards:

```bash
REQUIRE_CLEAN_GIT=0 ./scripts/deploy.sh
SKIP_LOCAL_TESTS=1 ./scripts/deploy.sh
```

## Server Requirements

The production server needs:

- `nginx`
- `systemd`
- `rsync`
- `curl`

The backend service must define the production environment variables, especially `TODO_INVITE_CODE`.

Current service file:

```text
/etc/systemd/system/todo-backend.service
```

Important runtime settings:

```text
TODO_DATABASE=/var/lib/todo/todo.db
TODO_COOKIE_SECURE=true
TODO_INVITE_CODE=<production invite code>
```

## Rollback

Every deploy creates a timestamped backup under:

```text
/var/backups/todo/<timestamp>/
```

If deployment fails during artifact installation, service restart, or backend health check, the script restores the previous backend binary and frontend dist, then restarts the service.

Manual rollback:

```bash
ssh root@8.160.182.56
systemctl stop todo-backend.service
install -m 0755 /var/backups/todo/<timestamp>/todo-server /opt/todo/todo-server
rm -rf /var/www/todo/dist
mkdir -p /var/www/todo/dist
rsync -a --delete /var/backups/todo/<timestamp>/dist/ /var/www/todo/dist/
systemctl start todo-backend.service
curl -fsS http://127.0.0.1:8888/ping
```

## Recommended Team Flow

For normal changes:

```bash
git checkout -b codex/short-change-name
# edit code
npm --prefix frontend test
(cd backend && go test ./...)
git add .
git commit -m "Describe change"
git push
```

After CI passes, deploy from the release branch:

```bash
./scripts/deploy.sh
```

For a larger team, the same script can be run from a CI/CD job after protected-branch checks pass.
