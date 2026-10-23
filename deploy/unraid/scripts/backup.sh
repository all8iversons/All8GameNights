#!/bin/sh
set -eu
umask 077

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
deployment_dir="$(CDPATH= cd -- "$script_dir/.." && pwd)"
env_file="$deployment_dir/.env"
destination="${1:-$deployment_dir/backups}"

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

for path in "$appdata_root/postgres" "$appdata_root/storage" "$appdata_root/db-config"; do
  if [ ! -d "$path" ]; then
    printf 'Required persistent data directory is missing: %s\n' "$path" >&2
    exit 1
  fi
done

mkdir -p "$destination"
destination="$(CDPATH= cd -- "$destination" && pwd)"
temporary_dir="$(mktemp -d "$destination/.game-night-backup.XXXXXX")"
archive="$destination/game-night-$(date -u +%Y%m%dT%H%M%SZ)-$$.tar.gz"
cleanup() {
  rm -rf "$temporary_dir"
  rm -f "$archive.partial"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$temporary_dir/configuration"
cp "$env_file" "$temporary_dir/configuration/.env"
cp "$deployment_dir/compose.yaml" "$temporary_dir/configuration/compose.yaml"
cp "$deployment_dir/supabase.override.yaml" "$temporary_dir/configuration/supabase.override.yaml"
cp -a "$appdata_root/storage" "$temporary_dir/storage"
cp -a "$appdata_root/db-config" "$temporary_dir/db-config"

upstream_commit="$(git -C "$deployment_dir/upstream" rev-parse HEAD)"
jq -n \
  --arg created_at "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg upstream_commit "$upstream_commit" \
  '{format_version: 1, created_at: $created_at, upstream_commit: $upstream_commit, contents: ["postgres.dump", "storage", "db-config", "configuration"]}' \
  > "$temporary_dir/manifest.json"

docker compose \
  --project-directory "$deployment_dir" \
  --file "$deployment_dir/compose.yaml" \
  exec --no-TTY db pg_dump --username postgres --dbname postgres --format custom --schema public --schema storage \
  > "$temporary_dir/postgres.dump"

tar -czf "$archive.partial" -C "$temporary_dir" \
  manifest.json postgres.dump storage db-config configuration
mv "$archive.partial" "$archive"
chmod 600 "$archive"
printf 'Created protected backup: %s\n' "$archive"
