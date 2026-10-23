#!/bin/sh
set -eu
umask 077

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
deployment_dir="$(CDPATH= cd -- "$script_dir/.." && pwd)"
env_file="$deployment_dir/.env"
archive="${1:-}"

if [ -z "$archive" ] || [ ! -f "$archive" ]; then
  printf 'Usage: %s <game-night-backup.tar.gz>\n' "$0" >&2
  exit 2
fi

for command in docker tar jq mktemp git; do
  if ! command -v "$command" >/dev/null 2>&1; then
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 1
  fi
done

if [ ! -f "$env_file" ]; then
  printf 'Deployment configuration is missing: %s\n' "$env_file" >&2
  exit 1
fi

appdata_root="$(awk -F= '$1 == "APPDATA_ROOT" { value = substr($0, index($0, "=") + 1) } END { print value }' "$env_file")"
case "$appdata_root" in
  /*) ;;
  *)
    printf '%s\n' 'APPDATA_ROOT must be an absolute path in deploy/unraid/.env.' >&2
    exit 1
    ;;
esac

if ! tar -tzf "$archive" >/dev/null 2>&1; then
  printf '%s\n' 'Backup archive is unreadable or invalid.' >&2
  exit 1
fi

if tar -tzf "$archive" | awk '
  /^\// || /(^|\/)\.\.(\/|$)/ { invalid = 1 }
  END { exit invalid ? 0 : 1 }
'; then
  printf '%s\n' 'Backup archive contains an unsafe path.' >&2
  exit 1
fi

if tar -tvzf "$archive" | awk '
  substr($0, 1, 1) != "-" && substr($0, 1, 1) != "d" { invalid = 1 }
  END { exit invalid ? 0 : 1 }
'; then
  printf '%s\n' 'Backup archive contains a link or unsupported file type.' >&2
  exit 1
fi

temporary_dir="$(mktemp -d)"
trap 'rm -rf "$temporary_dir"' EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM
tar --no-same-owner --no-same-permissions -xzf "$archive" -C "$temporary_dir"

for required in \
  "$temporary_dir/manifest.json" \
  "$temporary_dir/postgres.dump" \
  "$temporary_dir/storage" \
  "$temporary_dir/db-config" \
  "$temporary_dir/configuration/.env" \
  "$temporary_dir/configuration/compose.yaml" \
  "$temporary_dir/configuration/supabase.override.yaml"; do
  if [ ! -e "$required" ]; then
    printf 'Backup is missing required content: %s\n' "${required#"$temporary_dir"/}" >&2
    exit 1
  fi
done

if ! jq -e '.format_version == 1 and (.upstream_commit | type == "string") and (.contents | index("postgres.dump") != null)' \
  "$temporary_dir/manifest.json" >/dev/null; then
  printf '%s\n' 'Backup manifest is invalid or unsupported.' >&2
  exit 1
fi

current_upstream_commit="$(git -C "$deployment_dir/upstream" rev-parse HEAD)"
backup_upstream_commit="$(jq -r '.upstream_commit' "$temporary_dir/manifest.json")"
if [ "$current_upstream_commit" != "$backup_upstream_commit" ]; then
  printf '%s\n' 'Backup Supabase revision does not match this deployment. Prepare a compatible pinned checkout before restoring.' >&2
  exit 1
fi

compose() {
  docker compose \
    --project-directory "$deployment_dir" \
    --file "$deployment_dir/compose.yaml" \
    "$@"
}

running_services="$(compose ps --services --status running)"
if [ -n "$running_services" ]; then
  printf '%s\n' 'Stop the entire Compose project in Compose-Craft before restoring.' >&2
  printf 'Running services: %s\n' "$running_services" >&2
  exit 1
fi

if [ "${RESTORE_CONFIRM:-}" != YES ]; then
  if [ ! -t 0 ]; then
    printf '%s\n' 'Restore changes the game-night database and persistent files. Confirm interactively or set RESTORE_CONFIRM=YES.' >&2
    exit 1
  fi

  printf '%s\n' 'Restore will replace the public game-night and Supabase Storage database objects and storage files.'
  printf '%s' 'Continue? [y/N] '
  read -r answer
  case "$answer" in
    [Yy]|[Yy][Ee][Ss]) ;;
    *) printf '%s\n' 'Restore cancelled.'; exit 1 ;;
  esac
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)-$$"
mkdir -p "$appdata_root"

compose up -d db
ready=false
attempt=0
while [ "$attempt" -lt 60 ]; do
  if compose exec --no-TTY db pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$ready" != true ]; then
  compose stop db >/dev/null 2>&1 || true
  printf '%s\n' 'PostgreSQL did not become ready; inspect Compose-Craft logs before continuing.' >&2
  exit 1
fi

rollback_dump="$appdata_root/game-night-pre-restore-$timestamp.dump"
if ! compose exec --no-TTY db pg_dump --username postgres --dbname postgres --format custom --schema public --schema storage > "$rollback_dump"; then
  compose stop db >/dev/null 2>&1 || true
  rm -f "$rollback_dump"
  printf '%s\n' 'Could not create a pre-restore database snapshot; no restore changes were made.' >&2
  exit 1
fi
chmod 600 "$rollback_dump"
compose stop db

for name in storage db-config; do
  target="$appdata_root/$name"
  if [ -e "$target" ]; then
    mv "$target" "$target.pre-restore-$timestamp"
  fi
  mkdir -p "$target"
  cp -a "$temporary_dir/$name/." "$target/"
done

compose up -d db
ready=false
attempt=0
while [ "$attempt" -lt 60 ]; do
  if compose exec --no-TTY db pg_isready --username postgres --dbname postgres >/dev/null 2>&1; then
    ready=true
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if [ "$ready" != true ]; then
  compose stop db >/dev/null 2>&1 || true
  printf '%s\n' 'PostgreSQL did not become ready; inspect Compose-Craft logs before continuing.' >&2
  exit 1
fi

if ! cat "$temporary_dir/postgres.dump" | compose exec --no-TTY db \
  pg_restore --clean --if-exists --no-owner --schema public --schema storage --username postgres --dbname postgres -; then
  if ! cat "$rollback_dump" | compose exec --no-TTY db \
    pg_restore --clean --if-exists --no-owner --schema public --schema storage --username postgres --dbname postgres -; then
    printf 'Pre-restore database snapshot could not be reapplied; it is retained at %s\n' "$rollback_dump" >&2
  fi
  compose stop db >/dev/null 2>&1 || true
  printf 'Database restore failed. The pre-restore database snapshot is retained at %s; prior appdata directories have a .pre-restore suffix.\n' "$rollback_dump" >&2
  exit 1
fi

compose stop db
printf 'Restore completed. A pre-restore database snapshot is retained at %s. Review configuration/.env from the backup if the deployment secrets or origins have changed, then start the stack in Compose-Craft and verify saved records and Storage access.\n' "$rollback_dump"
