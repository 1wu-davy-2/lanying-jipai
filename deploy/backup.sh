#!/usr/bin/env bash
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/var/backups/lanying-jipai}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
: "${MYSQL_HOST:?Set MYSQL_HOST}"
: "${MYSQL_DATABASE:?Set MYSQL_DATABASE}"
: "${MYSQL_USER:?Set MYSQL_USER}"
: "${MYSQL_PASSWORD:?Set MYSQL_PASSWORD}"

install -d -m 0700 "$BACKUP_DIR"
timestamp="$(date +%Y%m%d-%H%M%S)"
target="$BACKUP_DIR/lanying-jipai-$timestamp.sql.gz"
MYSQL_PWD="$MYSQL_PASSWORD" mysqldump --single-transaction --quick --host="$MYSQL_HOST" --user="$MYSQL_USER" "$MYSQL_DATABASE" | gzip > "$target"
find "$BACKUP_DIR" -type f -name 'lanying-jipai-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete
echo "Backup written to $target"
