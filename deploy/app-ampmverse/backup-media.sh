#!/usr/bin/env bash
# Back up the box's local media store (D-106) — the only persistent state outside Postgres. Media lives on
# the box disk (STORAGE_PROVIDER=local), not S3, so it needs its own backup until the S3-in-Mumbai move;
# the provider's daily disk backup is the second layer. Run nightly via cron on the box, e.g.:
#   15 2 * * *  /var/www/vhosts/app.ampmverse.com/ampm-test/deploy/app-ampmverse/backup-media.sh >> /var/log/ampm-media-backup.log 2>&1
set -euo pipefail

SRC="${MEDIA_DIR:-/var/www/vhosts/app.ampmverse.com/ampm-storage}"
DEST="${BACKUP_DIR:-/var/www/vhosts/app.ampmverse.com/ampm-storage-backups}"
KEEP_DAYS="${KEEP_DAYS:-14}"

if [ ! -d "$SRC" ]; then
  echo "media dir $SRC not found" >&2
  exit 1
fi

mkdir -p "$DEST"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
archive="$DEST/media-$stamp.tar.gz"

# Archive the whole store (small: hotel photos + derivatives). -C so paths are relative to the store root.
tar -czf "$archive" -C "$SRC" .
echo "wrote $archive ($(du -h "$archive" | cut -f1))"

# Retention: drop archives older than KEEP_DAYS.
find "$DEST" -maxdepth 1 -name 'media-*.tar.gz' -mtime "+$KEEP_DAYS" -delete
echo "pruned media archives older than $KEEP_DAYS days"
