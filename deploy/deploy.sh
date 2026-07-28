#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/lanying-jipai}"
BACKEND_DIR="${BACKEND_DIR:-$APP_ROOT/backend}"
FRONTEND_DIR="${FRONTEND_DIR:-$APP_ROOT/frontend}"
FRONTEND_DIST="${FRONTEND_DIST:-$APP_ROOT/frontend-dist}"
VENV_DIR="${VENV_DIR:-$BACKEND_DIR/venv}"
BUILD_FRONTEND="${BUILD_FRONTEND:-false}"

git -C "$APP_ROOT" pull --ff-only
"$VENV_DIR/bin/pip" install --requirement "$BACKEND_DIR/requirements.txt"
"$VENV_DIR/bin/alembic" -c "$BACKEND_DIR/alembic.ini" upgrade head

if [[ "$BUILD_FRONTEND" == "true" ]]; then
  npm --prefix "$FRONTEND_DIR" ci
  npm --prefix "$FRONTEND_DIR" run build
fi

if [[ -d "$FRONTEND_DIR/dist" ]]; then
  install -d -m 0755 "$FRONTEND_DIST"
  rsync -a --delete "$FRONTEND_DIR/dist/" "$FRONTEND_DIST/"
fi

systemctl restart lanying-backend
curl --fail --silent --show-error http://127.0.0.1:8000/api/health >/dev/null
echo "Deployment completed successfully."
