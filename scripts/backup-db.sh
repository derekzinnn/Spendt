#!/usr/bin/env bash
#
# Daily dump of the Casa database.
#
# Run from cron on the VPS. Everything it needs comes from the running container, so no
# password is ever written here or in the crontab.
#
#   SPENDT_BACKUP_DIR   where dumps go      (default: ~/backups/spendt)
#   SPENDT_BACKUP_KEEP  days to keep        (default: 30)
#
# The dump is pg_dump's custom format (-Fc): compressed, and pg_restore can read a single
# table out of it. Restore with:
#
#   docker exec -i spendt-db pg_restore -U spendly -d spendly --clean --if-exists < FILE
#
set -euo pipefail

DIR="${SPENDT_BACKUP_DIR:-$HOME/backups/spendt}"
KEEP_DAYS="${SPENDT_BACKUP_KEEP:-30}"
CONTAINER="${SPENDT_DB_CONTAINER:-spendt-db}"

mkdir -p "$DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$DIR/spendt-$STAMP.dump"

if ! docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true; then
  echo "backup-db: container '$CONTAINER' is not running" >&2
  exit 1
fi

# Write to .part first: a dump killed halfway must never look like a good backup.
docker exec "$CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$TARGET.part"

# A dump that pg_restore cannot list is not a backup. Check before trusting it.
if ! docker exec -i "$CONTAINER" pg_restore --list > /dev/null < "$TARGET.part"; then
  echo "backup-db: the dump is unreadable, keeping it as $TARGET.bad" >&2
  mv "$TARGET.part" "$TARGET.bad"
  exit 1
fi

mv "$TARGET.part" "$TARGET"
SIZE="$(du -h "$TARGET" | cut -f1)"

# Only prune once today's dump is on disk and verified.
find "$DIR" -maxdepth 1 -name 'spendt-*.dump' -mtime "+$KEEP_DAYS" -delete

COUNT="$(find "$DIR" -maxdepth 1 -name 'spendt-*.dump' | wc -l | tr -d ' ')"
echo "backup-db: $TARGET ($SIZE) — $COUNT dumps kept, pruning after $KEEP_DAYS days"
