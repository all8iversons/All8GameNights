#!/bin/sh
set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
upstream_dir="$script_dir/upstream"
upstream_commit="8679b0b4d3b87e7b68e4ab91bc85f0d29c9e0110"
functions_dir="$(CDPATH= cd -- "$script_dir/../../supabase/functions" && pwd)"

if ! command -v git >/dev/null 2>&1; then
  printf '%s\n' 'Git is required to fetch the pinned official Supabase Docker deployment.' >&2
  exit 1
fi

if [ ! -f "$upstream_dir/docker/docker-compose.yml" ]; then
  mkdir -p "$upstream_dir"
  if [ ! -d "$upstream_dir/.git" ]; then
    git -C "$upstream_dir" init
  fi
  if ! git -C "$upstream_dir" remote get-url origin >/dev/null 2>&1; then
    git -C "$upstream_dir" remote add origin https://github.com/supabase/supabase.git
  fi
  git -C "$upstream_dir" fetch --depth 1 --filter=blob:none origin "$upstream_commit"
  git -C "$upstream_dir" sparse-checkout set docker
  git -C "$upstream_dir" checkout --detach FETCH_HEAD
fi

if [ "$(git -C "$upstream_dir" rev-parse HEAD)" != "$upstream_commit" ]; then
  printf '%s\n' 'The local Supabase checkout does not match the pinned commit. Remove deploy/unraid/upstream and rerun this script.' >&2
  exit 1
fi

if [ ! -f "$script_dir/.env" ]; then
  cp "$upstream_dir/docker/.env.example" "$script_dir/.env"
  cat "$script_dir/.env.example" >> "$script_dir/.env"
  printf 'GAME_NIGHT_FUNCTIONS_PATH=%s\n' "$functions_dir" >> "$script_dir/.env"

  cp "$script_dir/.env" "$upstream_dir/docker/.env"
  (
    cd "$upstream_dir/docker"
    sh utils/generate-keys.sh --update-env >/dev/null
  )
  cp "$upstream_dir/docker/.env" "$script_dir/.env"
  rm -f "$upstream_dir/docker/.env.old"
fi

cp "$script_dir/.env" "$upstream_dir/docker/.env"
chmod 600 "$script_dir/.env"
chmod 600 "$upstream_dir/docker/.env"
printf 'Prepared pinned Supabase stack at %s\n' "$upstream_dir/docker"
printf 'Review %s/.env and set SUPABASE_PUBLIC_URL to this server'\''s LAN address before starting Compose.\n' "$script_dir"
