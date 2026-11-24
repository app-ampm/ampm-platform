#!/usr/bin/env bash
# Snapshots the box's local media store (D-106, D-177), the only persistent state outside Postgres: each run
# makes a hard-link snapshot of the live store in ampm-media-snapshots/<UTC stamp>/ and keeps the newest 14.
# The API never rewrites a stored file: every write replaces the file with a new one, renamed over its key
# (LocalStorageAdapter.putObject), so a snapshot keeps the version it linked, and its files cost no space
# until the live file is replaced or deleted. The second layer is the VPS provider's daily disk backup,
# off the box, which the developer confirms in the provider's panel (production-setup.md, "Media snapshots").
#
# The live files belong to uid 1000 (the containers' `node` user), and fs.protected_hardlinks=1 lets only
# their owner, or root, link them. So the linking runs as uid 1000 in a throwaway container of the running
# app image (Debian slim with GNU coreutils; nothing is pulled), with no network, a read-only root, the
# vhost root's group, and a single bind mount of the vhost root: link() cannot cross mounts, and two bind
# mounts of one filesystem still count as two. Inside, the snapshot is linked into <stamp>.partial and
# renamed once complete, so only a complete snapshot gets a final name; a <stamp>.partial left by a run
# that died is removed, and so are the snapshots beyond the newest KEEP. Nothing else in the snapshot root
# is ever removed. A run whose new snapshot is pruned at once, because KEEP snapshots have later names (a
# clock set back), fails.
#
# The first run makes the snapshot root (owner uid 1000, mode 0750) through a root container that mounts
# its parent only, and only when it does not exist. An existing snapshot root must be a directory of the
# OWNER uid, so a mistyped SNAPSHOT_DIR never hands a folder over. The root sits beside the store, at the
# vhost root: uid 1000 reaches the vhost root (mode 710) through its group, but cannot enter ampm-backups
# (mode 700, the SSH user's alone; measured 24 Nov 2026). Neither the store nor the snapshots may be in the
# web root, httpdocs. Two runs never overlap: each holds a flock on LOCK_FILE, and a second one stops.
# BACKUP_DIR holds the nightly tar.gz archives this script wrote until 24 Nov 2026: once the new snapshot
# exists they are pruned after KEEP_DAYS, and no new one is written.
#
# Production's nightly cron entry on the box (the SSH user's crontab, UTC, installed 20 Nov 2026 and
# unchanged by the snapshots; V=/var/www/vhosts/app.ampmverse.com written out in full):
#   15 2 * * * MEDIA_DIR=$V/ampm-prod-storage BACKUP_DIR=$V/ampm-backups/media-prod bash $V/ampm-prod/deploy/app-ampmverse/backup-media.sh >> $V/ampm-backups/media-backup.log 2>&1
#
# Env, each defaulting to production's value:
#   MEDIA_DIR       the live store, inside VHOST_ROOT (default $VHOST_ROOT/ampm-prod-storage)
#   BACKUP_DIR      the old tar.gz archives, pruned after KEEP_DAYS (default $VHOST_ROOT/ampm-backups/media-prod)
#   SNAPSHOT_DIR    the snapshot root, inside VHOST_ROOT (default $VHOST_ROOT/ampm-media-snapshots)
#   KEEP            snapshots kept (default 14); KEEP_DAYS: days an old archive is kept (default 14)
#   VHOST_ROOT      default /var/www/vhosts/app.ampmverse.com
#   OWNER           uid:gid of the live files and the snapshots, never uid 0 (default 1000:1000)
#   APP_IMAGE_FILE  names the image (default $VHOST_ROOT/ampm-prod-state/app-image); when it is missing,
#                   the running ampm-api-1 container's image
#   LOCK_FILE       the lock the runs share (default $VHOST_ROOT/ampm-prod-state/backup-media.lock)
set -euo pipefail

VHOST_ROOT="${VHOST_ROOT:-/var/www/vhosts/app.ampmverse.com}"
SRC="${MEDIA_DIR:-$VHOST_ROOT/ampm-prod-storage}"
DEST="${BACKUP_DIR:-$VHOST_ROOT/ampm-backups/media-prod}"
SNAPSHOTS="${SNAPSHOT_DIR:-$VHOST_ROOT/ampm-media-snapshots}"
KEEP="${KEEP:-14}"
KEEP_DAYS="${KEEP_DAYS:-14}"
OWNER="${OWNER:-1000:1000}"
IMAGE_FILE="${APP_IMAGE_FILE:-$VHOST_ROOT/ampm-prod-state/app-image}"
LOCK="${LOCK_FILE:-$VHOST_ROOT/ampm-prod-state/backup-media.lock}"

die() {
  printf 'backup-media: %s\n' "$*" >&2
  exit 1
}

[[ "$KEEP" =~ ^[1-9][0-9]*$ && "$KEEP_DAYS" =~ ^[0-9]+$ ]] || die "KEEP and KEEP_DAYS must be whole numbers"
[[ "$OWNER" =~ ^[0-9]+:[0-9]+$ ]] || die "OWNER must be uid:gid, not '$OWNER'"
owner_uid=$((10#${OWNER%%:*}))
((owner_uid != 0)) || die "OWNER must not be root (uid 0): the snapshots are made as the owner of the live files"
[[ -d "$VHOST_ROOT" ]] || die "vhost root $VHOST_ROOT not found"

# One run at a time: a second one, from cron or by hand, stops instead of linking and pruning beside it.
command -v flock >/dev/null || die "flock (util-linux) not found"
exec 9>>"$LOCK" || die "cannot open the lock file $LOCK"
flock -n 9 || die "another run holds $LOCK, so this one stops"

[[ -d "$SRC" ]] || die "media dir $SRC not found"
[[ -d "$(dirname "$SNAPSHOTS")" ]] || die "the parent of the snapshot root $SNAPSHOTS not found"

# Compared once symlinks and `..` are resolved, so neither can lead a container outside the vhost root.
root="$(cd "$VHOST_ROOT" && pwd -P)"
media="$(cd "$SRC" && pwd -P)"
parent="$(cd "$(dirname "$SNAPSHOTS")" && pwd -P)"
base="$(basename "$SNAPSHOTS")"
snaps="$parent/$base"
web="$root/httpdocs"
if [[ -d "$web" ]]; then web="$(cd "$web" && pwd -P)"; fi
[[ "$base" != "." && "$base" != ".." && ! -L "$snaps" ]] ||
  die "the snapshot root $SNAPSHOTS must be a plain directory, not a link"
[[ "$media" == "$root"/* ]] || die "media dir $SRC is not inside the vhost root $root"
[[ "$snaps" == "$root"/* ]] || die "snapshot root $SNAPSHOTS is not inside the vhost root $root"
[[ "$snaps" != "$media" && "$snaps" != "$media"/* && "$media" != "$snaps"/* ]] ||
  die "the snapshot root and the media dir must not hold one another"
# The web root serves its files to anyone, so neither the store nor its snapshots may sit in it.
for dir in "$media" "$snaps"; do
  [[ "$dir" != "$web" && "$dir" != "$web"/* ]] || die "$dir is in the web root $web"
done
# The snapshot root is made when it does not exist, and used when it is a directory of the OWNER uid.
# Anything else is refused, so a mistyped SNAPSHOT_DIR (ampm-backups, ampm-prod-state) is never handed over.
make_root=0
if [[ ! -e "$snaps" ]]; then
  make_root=1
elif [[ ! -d "$snaps" || -z "$(find "$snaps" -maxdepth 0 -uid "$owner_uid")" ]]; then
  die "the snapshot root $snaps exists and is not a directory of uid $owner_uid, so it is not taken over" \
    "(remove it if it is an empty folder made by hand, or set SNAPSHOT_DIR)"
fi

image=""
if [[ -f "$IMAGE_FILE" ]]; then image="$(tr -d '[:space:]' <"$IMAGE_FILE")"; fi
if [[ -z "$image" ]]; then
  image="$(docker inspect ampm-api-1 --format '{{.Config.Image}}' 2>/dev/null || true)"
fi
[[ -n "$image" ]] ||
  die "cannot find the app image: $IMAGE_FILE is missing or empty, and no ampm-api-1 container runs"
docker image inspect "$image" >/dev/null 2>&1 || die "the app image $image is not on this host"

run=(docker run --rm --pull never --network none --read-only --security-opt no-new-privileges)

# One-time setup: the SSH user cannot chown, so a root container makes the snapshot root. Its mkdir has
# no -p, so it fails if anything has appeared at that path since the check above.
if ((make_root)); then
  # shellcheck disable=SC2016  # expanded by the container's sh, from its arguments
  "${run[@]}" --user 0 -v "$parent:/b" --entrypoint /bin/sh "$image" \
    -c 'mkdir "$1" && chown "$2" "$1" && chmod 0750 "$1"' sh "/b/$base" "$OWNER"
  echo "backup-media: made the snapshot root $snaps (owner $OWNER, mode 0750)"
fi

# The container's part, in POSIX sh: $1 the live store, $2 the snapshot root, $3 the stamp, $4 KEEP.
# shellcheck disable=SC2016  # expanded by the container's sh, from its arguments
SNAPSHOT_SH='set -eu
media=$1 root=$2 stamp=$3 keep=$4
if [ ! -r "$media" ] || [ ! -x "$media" ] || ! cd "$root" 2>/dev/null; then
  echo "backup-media: uid $(id -u) cannot reach the media store or the snapshot root through the vhost root" >&2
  exit 1
fi
for stale in ./[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z.partial; do
  if [ -e "$stale" ]; then rm -rf -- "$stale"; fi
done
if [ -e "$stamp" ]; then
  echo "backup-media: snapshot $stamp already exists" >&2
  exit 1
fi
cp -al -- "$media" "$stamp.partial"
mv -- "$stamp.partial" "$stamp"
files=$(find "$stamp" -type f | wc -l | tr -d " ")
ls -1 | grep -E "^[0-9]{8}T[0-9]{6}Z$" | sort -r | tail -n "+$((keep + 1))" | while read -r old; do
  rm -rf -- "$old"
done
if [ ! -d "$stamp" ]; then
  echo "backup-media: the new snapshot $stamp was pruned at once: $keep snapshots have later names, so this host'"'"'s clock is behind them" >&2
  exit 1
fi
kept=$(ls -1 | grep -cE "^[0-9]{8}T[0-9]{6}Z$" || true)
printf "media snapshot %s: %s files, %s snapshots kept\n" "$stamp" "$files" "$kept"'

# A Plesk vhost root may be searchable by its own group only, which uid 1000 is not in, so the container
# also takes that group: enough to reach the store and the snapshots, and nothing the group cannot.
# shellcheck disable=SC2012  # ls is the numeric-group reader GNU (the box) and BSD (the test's Mac) share
vhost_gid="$(ls -nd "$root" | awk '{print $4}')"
"${run[@]}" --user "$OWNER" --group-add "$vhost_gid" -v "$root:/v" --entrypoint /bin/sh "$image" \
  -c "$SNAPSHOT_SH" sh "/v/${media#"$root"/}" "/v/${snaps#"$root"/}" "$(date -u +%Y%m%dT%H%M%SZ)" "$KEEP"

# Only after a snapshot exists, so a failing snapshot never leaves the box with no media backup at all.
if [[ -d "$DEST" ]]; then
  find "$DEST" -maxdepth 1 -name 'media-*.tar.gz' -mtime "+$KEEP_DAYS" -delete
fi
