#!/bin/sh
set -eu

alembic upgrade head

exec gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "${WEB_CONCURRENCY:-2}" \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
