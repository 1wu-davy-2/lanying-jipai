#!/usr/bin/env bash
set -euo pipefail

HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:8000/api/health}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"

if curl --fail --silent --max-time 10 "$HEALTH_URL" | grep -q '"status":"healthy"'; then
  exit 0
fi

message="lanying-jipai health check failed: $HEALTH_URL"
echo "$message" >&2
if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
  curl --fail --silent --show-error --max-time 10 -X POST -H 'Content-Type: application/json' --data "{\"text\":\"$message\"}" "$ALERT_WEBHOOK_URL" || true
fi
exit 1
