#!/usr/bin/env bash
# Test of deploy/app-ampmverse/backup-media.sh, the media snapshots (D-177), against a scratch vhost. A
# `docker` stub on PATH runs each container's `sh -c` script on this machine, with the container side of
# its -v mounts mapped back to the scratch directories, so the real linking, pruning and partial-cleanup
# logic runs. It checks that:
#   - every snapshot file is a hard link of its live file (the same inode), and each run logs one line;
#   - a 15th snapshot prunes the oldest, a .partial left over is removed, and nothing but snapshot names
#     is ever pruned;
#   - a run with neither MEDIA_DIR nor BACKUP_DIR set snapshots the production store and prunes its
#     archives;
#   - the old tar.gz archives past 14 days are pruned only once a new snapshot exists, and no new one is
#     written;
#   - these are refused before any container runs: a path outside the vhost root or in its web root, a
#     snapshot root that is a link, holds the store or sits in it, or is an existing folder that is not the
#     owner's, OWNER uid 0, and an image that cannot be found;
#   - a run whose new snapshot is pruned at once (a clock behind the newest names) fails;
#   - a second run stops while another holds the lock.
#   bash deploy/backup-media.test.sh
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
failures=0
status=0

ok() { printf 'ok   %s\n' "$1"; }
bad() {
  printf 'FAIL %s\n' "$1" >&2
  failures=$((failures + 1))
}
exits() {
  if [[ "$status" == "$1" ]]; then
    ok "$2 exits $1"
  else
    bad "$2 exits $status, not $1"
    sed 's/^/     | /' "$work/out" >&2
  fi
}
said() { if grep -qF -- "$1" "$work/out"; then ok "output says '$1'"; else bad "output does not say '$1'"; fi; }
ran() { if grep -qF -- "$1" "$work/docker.log"; then ok "docker ran with '$1'"; else bad "docker never ran with '$1'"; fi; }
never() { if grep -qF -- "$1" "$work/docker.log"; then bad "docker ran with '$1'"; else ok "docker never ran with '$1'"; fi; }
present() { if [[ -e "$1" ]]; then ok "$2"; else bad "$2 (missing: ${1#"$work"/})"; fi; }
absent() { if [[ ! -e "$1" ]]; then ok "$2"; else bad "$2 (still there: ${1#"$work"/})"; fi; }
# refused <what> <message>: the last run exited 1 with the message and ran no container.
refused() {
  exits 1 "$1"
  said "$2"
  never "run "
}
# ls is the one reader of an inode, a mode and an owner that both GNU (CI) and BSD (macOS) tools share.
# shellcheck disable=SC2012
inode() { ls -id "$1" | awk '{print $1}'; }
# shellcheck disable=SC2012
mode() { ls -ld "$1" | cut -c1-10; }
# shellcheck disable=SC2012
gid() { ls -nd "$1" | awk '{print $4}'; }
# listing <dir>: its mode, owner and entries, to compare before and after a refused run.
# shellcheck disable=SC2012
listing() { printf '%s | %s\n' "$(ls -nd "$1" | awk '{print $1, $3, $4}')" "$(ls -A "$1" | tr '\n' ' ')"; }

# The stand-in for docker. `run` executes the container's `sh -c` script here, its container paths mapped
# back through the -v mounts, or fails the snapshot container when STUB_FAIL_SNAPSHOT=1; `inspect`
# answers the running API's image when STUB_RUNNING_IMAGE is set; `image inspect` finds the image unless
# STUB_NO_IMAGE=1. Every call is logged.
mkdir -p "$work/bin"
cat >"$work/bin/docker" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' "$*" >>"$DOCKER_LOG"
case "${1:-}" in
  inspect)
    [[ -n "${STUB_RUNNING_IMAGE:-}" ]] || exit 1
    printf '%s\n' "$STUB_RUNNING_IMAGE"
    exit 0
    ;;
  image) [[ "${STUB_NO_IMAGE:-}" != 1 ]] && exit 0 || exit 1 ;;
  run) shift ;;
  *) exit 0 ;;
esac
if [[ "${STUB_FAIL_SNAPSHOT:-}" == 1 && " $* " != *" --user 0 "* ]]; then
  echo "docker stub: the snapshot container failed" >&2
  exit 1
fi
hosts=()
ctrs=()
while [[ $# -gt 0 && "$1" == -* ]]; do
  case "$1" in
    -v | --volume)
      hosts+=("${2%%:*}")
      ctr="${2#*:}"
      ctrs+=("${ctr%%:*}")
      shift 2
      ;;
    --user | --group-add | --network | --security-opt | --entrypoint | --pull) shift 2 ;;
    *) shift ;;
  esac
done
shift # the image
[[ "${1:-}" == -c ]] || {
  echo "docker stub: expected -c and a script after the image" >&2
  exit 2
}
inner="$2"
name="$3"
shift 3
args=()
for arg in "$@"; do
  i=0
  while [[ $i -lt ${#ctrs[@]} ]]; do
    if [[ "$arg" == "${ctrs[$i]}" || "$arg" == "${ctrs[$i]}"/* ]]; then
      arg="${hosts[$i]}${arg#"${ctrs[$i]}"}"
      break
    fi
    i=$((i + 1))
  done
  args+=("$arg")
done
exec sh -c "$inner" "$name" "${args[@]}"
STUB
chmod +x "$work/bin/docker"

# The script takes its lock with flock(1), from util-linux: the box and CI have it, macOS does not. There
# a stand-in for the one form the script uses, `flock -n FD`, makes the same flock(2) call through perl on
# the descriptor it inherits. With neither, a stand-in that always succeeds keeps the other cases running
# and the overlap case is skipped.
lock_works=1
if ! command -v flock >/dev/null 2>&1; then
  if command -v perl >/dev/null 2>&1; then
    cat >"$work/bin/flock" <<'FLOCK'
#!/usr/bin/env bash
[[ $# == 2 && "$1" == -n && "$2" =~ ^[0-9]+$ ]] || { echo "flock stand-in: only 'flock -n FD'" >&2; exit 64; }
exec perl -MFcntl=:flock -e 'open(my $fd, ">&=", $ARGV[0]) or exit 1; flock($fd, LOCK_EX | LOCK_NB) or exit 1' "$2"
FLOCK
  else
    printf '#!/bin/sh\nexit 0\n' >"$work/bin/flock"
    lock_works=0
  fi
  chmod +x "$work/bin/flock"
fi

vhost="$work/vhost"
live="$vhost/ampm-prod-storage"
archives="$vhost/ampm-backups/media-prod"
snaps="$vhost/ampm-media-snapshots"
mkdir -p "$live/media/h1/web" "$live/media/h2" "$archives" "$vhost/ampm-prod-state" \
  "$vhost/ampm-storage/media" "$vhost/httpdocs/storage" "$work/elsewhere/snapshots"
printf 'synthetic photo\n' >"$live/media/h1/original.jpg"
printf 'synthetic web size\n' >"$live/media/h1/web/large.webp"
printf 'synthetic thumbnail\n' >"$live/media/h1/web/thumb.webp"
printf 'synthetic document\n' >"$live/media/h2/contract.pdf"
printf 'synthetic test-stack photo\n' >"$vhost/ampm-storage/media/old.jpg"
printf '<p>synthetic page</p>\n' >"$vhost/httpdocs/index.html"
printf '%s\n' ampm-prod-app:aaaaaaaaaaaa >"$vhost/ampm-prod-state/app-image"
: >"$archives/media-recent.tar.gz"
real_vhost="$(cd "$vhost" && pwd -P)"
other_uid=$(($(id -u) + 1))
STAMP='[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]T[0-9][0-9][0-9][0-9][0-9][0-9]Z'

# old_archive: an archive of the kind the script wrote until 24 Nov 2026, older than 14 days.
old_archive() {
  : >"$archives/media-20200101T021500Z.tar.gz"
  touch -t 202001010215 "$archives/media-20200101T021500Z.tar.gz"
}
# backup [NAME=value ...]: run the script through the stub with only VHOST_ROOT, OWNER and the given
# settings; output in $work/out, docker calls in $work/docker.log, exit status in $status.
backup() {
  status=0
  : >"$work/docker.log"
  env -u MEDIA_DIR -u BACKUP_DIR -u SNAPSHOT_DIR -u KEEP -u KEEP_DAYS -u APP_IMAGE_FILE -u LOCK_FILE \
    PATH="$work/bin:$PATH" DOCKER_LOG="$work/docker.log" VHOST_ROOT="$vhost" OWNER="$(id -u):$(id -g)" "$@" \
    bash "$here/app-ampmverse/backup-media.sh" >"$work/out" 2>&1 || status=$?
}
# cron [NAME=value ...]: a run as production's crontab makes it, with MEDIA_DIR and BACKUP_DIR set.
cron() { backup MEDIA_DIR="$live" BACKUP_DIR="$archives" "$@"; }
# snapshots [root]: the snapshot directories by name, oldest first.
snapshots() {
  local root="${1:-$snaps}"
  [[ -d "$root" ]] || return 0
  find "$root" -mindepth 1 -maxdepth 1 -type d -name "$STAMP" -exec basename {} \; | sort
}
# settle: gives the newest snapshot an earlier name of its own, so that the next run, which may start in
# the same second, cannot meet its stamp.
settled=0
settle() {
  local newest
  newest="$(snapshots | tail -n 1)"
  settled=$((settled + 1))
  mv "$snaps/$newest" "$snaps/$(printf '202501%02dT021500Z' "$settled")"
}
# linked <snapshot>: every live file is in the snapshot under the same inode (a hard link, not a copy).
linked() {
  local rel copies=0 links=0
  while IFS= read -r rel; do
    copies=$((copies + 1))
    if [[ -f "$snaps/$1/$rel" && "$(inode "$live/$rel")" == "$(inode "$snaps/$1/$rel")" ]]; then
      links=$((links + 1))
    fi
  done < <(cd "$live" && find . -type f)
  if ((copies == 4 && links == 4)); then
    ok "$1 links all 4 live files"
  else
    bad "$1 links $links of the $copies live files"
  fi
}

echo "# 1. The first run, as the cron makes it: the snapshot root, then a snapshot of hard links"
old_archive
cron
exits 0 "the first run"
present "$snaps" "the snapshot root exists"
if [[ "$(mode "$snaps")" == drwxr-x--- ]]; then ok "the snapshot root is mode 0750"; else bad "the snapshot root is $(mode "$snaps")"; fi
said "made the snapshot root"
ran "--user 0 -v $real_vhost:/b"
ran "--rm --pull never --network none --read-only --security-opt no-new-privileges --user $(id -u):$(id -g) --group-add $(gid "$vhost") -v $real_vhost:/v --entrypoint /bin/sh ampm-prod-app:aaaaaaaaaaaa"
first="$(snapshots)"
if [[ "$(printf '%s\n' "$first" | grep -c .)" == 1 ]]; then ok "one snapshot, $first"; else bad "snapshots after the first run: $first"; fi
linked "$first"
said "media snapshot $first: 4 files, 1 snapshots kept"
absent "$archives/media-20200101T021500Z.tar.gz" "the archive older than 14 days is pruned"
present "$archives/media-recent.tar.gz" "a recent archive is kept"
if [[ "$(find "$archives" -name 'media-*.tar.gz' | grep -c .)" == 1 ]]; then ok "no new archive is written"; else bad "an archive was written"; fi

echo "# 2. A 15th snapshot prunes the oldest and a stale .partial; nothing but snapshot names is pruned"
settle
for day in 01 02 03 04 05 06 07 08 09 10 11 12 13; do mkdir "$snaps/202001${day}T021500Z"; done
mkdir "$snaps/20200114T021500Z.partial"
printf 'half a snapshot\n' >"$snaps/20200114T021500Z.partial/leftover.jpg"
# Each sorts below every snapshot name, so a prune that read more than snapshot names would take it.
for name in 0-keep-me 0-keep-me-Z 0-keep-me.partial; do
  mkdir "$snaps/$name"
  printf 'synthetic note\n' >"$snaps/$name/note.txt"
done
cron
exits 0 "the 15th run"
newest="$(snapshots | tail -n 1)"
if [[ "$(snapshots | grep -c .)" == 14 ]]; then ok "14 snapshots kept"; else bad "$(snapshots | grep -c .) snapshots kept"; fi
absent "$snaps/20200101T021500Z" "the oldest snapshot is pruned"
present "$snaps/20200102T021500Z" "the next oldest is kept"
present "$snaps/20250101T021500Z" "the earlier run's snapshot is kept"
absent "$snaps/20200114T021500Z.partial" "the .partial left over is removed"
for name in 0-keep-me 0-keep-me-Z 0-keep-me.partial; do
  present "$snaps/$name/note.txt" "$name, not a snapshot's name, is left alone"
done
linked "$newest"
said "media snapshot $newest: 4 files, 14 snapshots kept"
never "--user 0"

echo "# 3. With neither MEDIA_DIR nor BACKUP_DIR set, the production store and its archives"
settle
old_archive
backup
exits 0 "a run with the defaults"
ran "sh /v/ampm-prod-storage /v/ampm-media-snapshots "
never "/v/ampm-storage "
linked "$(snapshots | tail -n 1)"
absent "$archives/media-20200101T021500Z.tar.gz" "the production store's archive older than 14 days is pruned"

echo "# 4. A snapshot that fails leaves the old archives where they are"
settle
old_archive
cron STUB_FAIL_SNAPSHOT=1
exits 1 "a run whose snapshot container fails"
present "$archives/media-20200101T021500Z.tar.gz" "the old archive is kept while no new snapshot exists"

echo "# 5. Refusals, before any container runs"
cron MEDIA_DIR="$work/elsewhere"
refused "a media dir outside the vhost root" "is not inside the vhost root"
cron MEDIA_DIR="$vhost/../elsewhere"
refused "a media dir that climbs out with .." "is not inside the vhost root"
cron SNAPSHOT_DIR="$work/elsewhere/snapshots"
refused "a snapshot root outside the vhost root" "is not inside the vhost root"
ln -s "$work/elsewhere/snapshots" "$vhost/linked-snapshots"
cron SNAPSHOT_DIR="$vhost/linked-snapshots"
refused "a snapshot root that is a link" "not a link"
if [[ -z "$(ls -A "$work/elsewhere/snapshots")" ]]; then ok "nothing is written through the link"; else bad "a snapshot was written through the link"; fi
cron SNAPSHOT_DIR="$live/snapshots"
refused "a snapshot root inside the media store" "must not hold one another"
cron SNAPSHOT_DIR="$live"
refused "the media store as the snapshot root" "must not hold one another"
# A store inside the snapshot root, named as a snapshot is: a run would link it into itself, then prune it.
mkdir -p "$snaps/20000101T000000Z/media"
printf 'synthetic photo\n' >"$snaps/20000101T000000Z/media/photo.jpg"
cron MEDIA_DIR="$snaps/20000101T000000Z"
refused "a media dir inside the snapshot root" "must not hold one another"
present "$snaps/20000101T000000Z/media/photo.jpg" "the store inside the snapshot root is left alone"
rm -rf "$snaps/20000101T000000Z"
cron SNAPSHOT_DIR="$vhost/httpdocs/media-snapshots"
refused "a snapshot root in the web root" "in the web root"
cron SNAPSHOT_DIR="$vhost/httpdocs"
refused "the web root as the snapshot root" "in the web root"
cron MEDIA_DIR="$vhost/httpdocs/storage"
refused "a media dir in the web root" "in the web root"
# The scratch vhost is this user's, so an OWNER of another uid stands in for uid 1000 on the box.
for folder in ampm-backups ampm-prod-state; do
  before="$(listing "$vhost/$folder")"
  cron SNAPSHOT_DIR="$vhost/$folder" OWNER="$other_uid:$(id -g)"
  refused "$folder, a folder of another uid, as the snapshot root" "is not taken over"
  if [[ "$(listing "$vhost/$folder")" == "$before" ]]; then ok "$folder is left as it was"; else bad "$folder was changed"; fi
done
mkdir "$vhost/made-by-hand"
cron SNAPSHOT_DIR="$vhost/made-by-hand" OWNER="$other_uid:$(id -g)"
refused "an empty folder of another uid as the snapshot root" "is not taken over"
: >"$vhost/a-file"
cron SNAPSHOT_DIR="$vhost/a-file"
refused "a file as the snapshot root" "is not taken over"
# A snapshot root yet to be made, so that only the OWNER check stands between uid 0 and a root container.
cron OWNER=0:0 SNAPSHOT_DIR="$vhost/new-snapshots"
refused "OWNER uid 0" "OWNER must not be root"
cron OWNER=000:1000 SNAPSHOT_DIR="$vhost/new-snapshots"
refused "OWNER uid 0, written 000" "OWNER must not be root"
absent "$vhost/new-snapshots" "no snapshot root is made for uid 0"
rm "$vhost/ampm-prod-state/app-image"
cron
refused "no recorded image and no running API" "cannot find the app image"
cron STUB_RUNNING_IMAGE=ampm-prod-app:bbbbbbbbbbbb STUB_NO_IMAGE=1
refused "an image this host does not hold" "is not on this host"

echo "# 6. Without a recorded image, the running API's image is used"
settle
cron STUB_RUNNING_IMAGE=ampm-prod-app:bbbbbbbbbbbb
exits 0 "a run with the running API's image"
ran "--entrypoint /bin/sh ampm-prod-app:bbbbbbbbbbbb"
printf '%s\n' ampm-prod-app:aaaaaaaaaaaa >"$vhost/ampm-prod-state/app-image"

echo "# 7. A clock behind the newest snapshot names fails the run"
future="$vhost/future-snapshots"
mkdir "$future"
for day in 01 02 03 04 05 06 07 08 09 10 11 12 13 14; do mkdir "$future/209901${day}T021500Z"; done
cron SNAPSHOT_DIR="$future"
exits 1 "a run whose new snapshot sorts below 14 later names"
said "was pruned"
if [[ "$(snapshots "$future" | grep -c .)" == 14 && "$(snapshots "$future" | head -n 1)" == 20990101T021500Z ]]; then
  ok "the 14 later snapshots are left"
else
  bad "the snapshots left: $(snapshots "$future" | tr '\n' ' ')"
fi

echo "# 8. Two runs never overlap"
if ((lock_works)); then
  settle
  exec 8>>"$vhost/ampm-prod-state/backup-media.lock"
  PATH="$work/bin:$PATH" flock -n 8
  cron
  exec 8>&-
  refused "a run while another holds the lock" "another run holds"
  cron
  exits 0 "the next run, once the lock is free,"
else
  echo "skip a run while another holds the lock: this machine has neither flock nor perl"
fi

if ((failures > 0)); then
  echo "$failures backup-media check(s) failed" >&2
  exit 1
fi
echo "all backup-media checks passed"
