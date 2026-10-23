#!/bin/sh
set -eu

: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL is required}"
: "${VITE_SUPABASE_PUBLISHABLE_KEY:?VITE_SUPABASE_PUBLISHABLE_KEY is required}"

if ! printf '%s' "$VITE_SUPABASE_URL" | grep -Eq '^https?://[^/@[:space:]]+(:[0-9]+)?/?$'; then
  printf '%s\n' 'VITE_SUPABASE_URL must be an absolute HTTP or HTTPS URL without credentials.' >&2
  exit 1
fi

runtime_config="$(jq -cn \
  --arg url "$VITE_SUPABASE_URL" \
  --arg publishableKey "$VITE_SUPABASE_PUBLISHABLE_KEY" \
  '{supabaseUrl: $url, supabasePublishableKey: $publishableKey}')"

printf 'window.__APP_CONFIG__ = %s;\n' "$runtime_config" \
  > /usr/share/nginx/html/runtime-config.js

exec "$@"
