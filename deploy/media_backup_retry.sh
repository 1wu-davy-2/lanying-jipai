#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/lanying-jipai}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
VENV_DIR="${VENV_DIR:-$BACKEND_DIR/venv}"
LIMIT="${MEDIA_BACKUP_RETRY_LIMIT:-100}"

cd "$BACKEND_DIR"
exec "$VENV_DIR/bin/python" -m scripts.retry_media_backups --limit "$LIMIT"
