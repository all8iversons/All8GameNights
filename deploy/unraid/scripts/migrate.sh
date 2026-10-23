#!/bin/sh
set -eu

: "${PGHOST:?PGHOST is required}"
: "${PGPORT:?PGPORT is required}"
: "${PGUSER:?PGUSER is required}"
: "${PGDATABASE:?PGDATABASE is required}"
: "${PGPASSWORD:?PGPASSWORD is required}"

psql_cmd() {
  psql \
    --host "$PGHOST" \
    --port "$PGPORT" \
    --username "$PGUSER" \
    --dbname "$PGDATABASE" \
    --set ON_ERROR_STOP=1 \
    "$@"
}

psql_cmd --command '
  create table if not exists public.app_schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )
'

apply_sql_file() {
  file="$1"
  version="$(basename "$file")"
  applied="$(psql_cmd --tuples-only --no-align --command \
    "select exists (select 1 from public.app_schema_migrations where version = '$version')")"

  if [ "$applied" = "t" ]; then
    return
  fi

  {
    printf 'begin;\n'
    cat "$file"
    printf "\ninsert into public.app_schema_migrations (version) values ('%s');\ncommit;\n" "$version"
  } | psql_cmd
  printf 'Applied database migration: %s\n' "$version"
}

for file in /migrations/*.sql; do
  [ -f "$file" ] || continue
  apply_sql_file "$file"
done

apply_sql_file /seed/seed.sql
