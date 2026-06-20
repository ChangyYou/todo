#!/usr/bin/env bash
set -Eeuo pipefail

APP_NAME="${APP_NAME:-todo}"
DEPLOY_HOST="${DEPLOY_HOST:-root@8.160.182.56}"
REMOTE_STAGE_ROOT="${REMOTE_STAGE_ROOT:-/tmp/todo-deploy}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/todo}"
REMOTE_WEB_DIR="${REMOTE_WEB_DIR:-/var/www/todo/dist}"
REMOTE_BACKUP_DIR="${REMOTE_BACKUP_DIR:-/var/backups/todo}"
SERVICE_NAME="${SERVICE_NAME:-todo-backend.service}"
REMOTE_HEALTH_URL="${REMOTE_HEALTH_URL:-http://127.0.0.1:8888/ping}"
PUBLIC_HEALTH_URL="${PUBLIC_HEALTH_URL:-https://todo.youchangblog.cn/}"
REQUIRE_CLEAN_GIT="${REQUIRE_CLEAN_GIT:-1}"
SKIP_LOCAL_TESTS="${SKIP_LOCAL_TESTS:-0}"
TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
BUILD_ROOT=""

log() {
  printf '[deploy] %s\n' "$*"
}

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

need git
need ssh
need rsync
need npm
need go

ROOT_DIR="$(git rev-parse --show-toplevel)"
cd "$ROOT_DIR"

if [ "$REQUIRE_CLEAN_GIT" = "1" ] && [ -n "$(git status --porcelain)" ]; then
  printf 'Git working tree is not clean. Commit changes first, or run REQUIRE_CLEAN_GIT=0 %s.\n' "$0" >&2
  exit 1
fi

BUILD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/todo-deploy.XXXXXX")"
trap 'rm -rf "$BUILD_ROOT"' EXIT
BACKEND_BINARY="${BUILD_ROOT}/todo-server"

log "Installing frontend dependencies"
(cd frontend && npm ci)

if [ "$SKIP_LOCAL_TESTS" != "1" ]; then
  log "Running local frontend tests"
  (cd frontend && npm test)

  log "Running local backend tests"
  (cd backend && go test ./...)
else
  log "Skipping local checks because SKIP_LOCAL_TESTS=1"
fi

log "Building frontend artifact"
(cd frontend && npm run build)

log "Building Linux backend artifact"
(cd backend && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -trimpath -o "$BACKEND_BINARY" ./cmd/server)

REMOTE_RELEASE="${REMOTE_STAGE_ROOT}/${APP_NAME}-${TIMESTAMP}"
REMOTE_ARTIFACTS="${REMOTE_RELEASE}/artifacts"

log "Creating remote staging directory on ${DEPLOY_HOST}"
ssh "$DEPLOY_HOST" "mkdir -p '$REMOTE_ARTIFACTS/frontend' '$REMOTE_ARTIFACTS/backend'"

log "Uploading frontend artifact"
rsync -az --delete "$ROOT_DIR/frontend/dist"/ "$DEPLOY_HOST:$REMOTE_ARTIFACTS/frontend"/

log "Uploading backend artifact"
rsync -az "$BACKEND_BINARY" "$DEPLOY_HOST:$REMOTE_ARTIFACTS/backend/todo-server"

log "Deploying artifacts on remote host"
ssh "$DEPLOY_HOST" "bash -s" -- \
  "$REMOTE_ARTIFACTS" \
  "$REMOTE_STAGE_ROOT" \
  "$REMOTE_APP_DIR" \
  "$REMOTE_WEB_DIR" \
  "$REMOTE_BACKUP_DIR" \
  "$SERVICE_NAME" \
  "$REMOTE_HEALTH_URL" \
  "$TIMESTAMP" <<'REMOTE_SCRIPT'
set -Eeuo pipefail

ARTIFACTS_DIR="$1"
REMOTE_STAGE_ROOT="$2"
REMOTE_APP_DIR="$3"
REMOTE_WEB_DIR="$4"
REMOTE_BACKUP_DIR="$5"
SERVICE_NAME="$6"
REMOTE_HEALTH_URL="$7"
TIMESTAMP="$8"
RELEASE_DIR="$(dirname "$ARTIFACTS_DIR")"
BACKUP_DIR="${REMOTE_BACKUP_DIR}/${TIMESTAMP}"

log() {
  printf '[remote deploy] %s\n' "$*"
}

need() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required remote command: %s\n' "$1" >&2
    exit 1
  fi
}

rollback() {
  log "Rolling back to backup ${BACKUP_DIR}"

  if [ -f "${BACKUP_DIR}/todo-server" ]; then
    install -m 0755 "${BACKUP_DIR}/todo-server" "${REMOTE_APP_DIR}/todo-server"
  fi

  if [ -d "${BACKUP_DIR}/dist" ]; then
    rm -rf "${REMOTE_WEB_DIR}"
    mkdir -p "${REMOTE_WEB_DIR}"
    rsync -a --delete "${BACKUP_DIR}/dist/" "${REMOTE_WEB_DIR}/"
  fi

  systemctl restart "${SERVICE_NAME}" || true
}

need rsync
need curl
need systemctl

mkdir -p "$BACKUP_DIR" "$REMOTE_APP_DIR" "$(dirname "$REMOTE_WEB_DIR")"

if [ -f "${REMOTE_APP_DIR}/todo-server" ]; then
  cp -p "${REMOTE_APP_DIR}/todo-server" "${BACKUP_DIR}/todo-server"
fi

if [ -d "${REMOTE_WEB_DIR}" ]; then
  mkdir -p "${BACKUP_DIR}/dist"
  rsync -a --delete "${REMOTE_WEB_DIR}/" "${BACKUP_DIR}/dist/"
fi

deploy_status=0
{
  log "Installing backend binary"
  install -m 0755 "${ARTIFACTS_DIR}/backend/todo-server" "${REMOTE_APP_DIR}/todo-server.next"
  mv -f "${REMOTE_APP_DIR}/todo-server.next" "${REMOTE_APP_DIR}/todo-server"

  log "Installing frontend dist"
  NEXT_WEB_DIR="${REMOTE_WEB_DIR}.next-${TIMESTAMP}"
  PREVIOUS_WEB_DIR="${REMOTE_WEB_DIR}.previous"
  rm -rf "$NEXT_WEB_DIR" "$PREVIOUS_WEB_DIR"
  mkdir -p "$NEXT_WEB_DIR"
  rsync -a --delete "${ARTIFACTS_DIR}/frontend/" "${NEXT_WEB_DIR}/"
  if [ -d "${REMOTE_WEB_DIR}" ]; then
    mv "${REMOTE_WEB_DIR}" "$PREVIOUS_WEB_DIR"
  fi
  mv "$NEXT_WEB_DIR" "${REMOTE_WEB_DIR}"
  rm -rf "$PREVIOUS_WEB_DIR"

  log "Restarting ${SERVICE_NAME}"
  systemctl restart "${SERVICE_NAME}"
  sleep 2
  systemctl is-active --quiet "${SERVICE_NAME}"

  log "Checking backend health"
  curl -fsS "${REMOTE_HEALTH_URL}" >/dev/null
} || deploy_status=$?

if [ "$deploy_status" -ne 0 ]; then
  rollback
  exit "$deploy_status"
fi

log "Cleaning remote staging"
rm -rf "$RELEASE_DIR"
find "$REMOTE_STAGE_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +

log "Deploy complete"
REMOTE_SCRIPT

if command -v curl >/dev/null 2>&1; then
  log "Checking public site ${PUBLIC_HEALTH_URL}"
  curl -fsSI "$PUBLIC_HEALTH_URL" >/dev/null
else
  log "curl not found locally; skipped public site check"
fi

log "Done"
