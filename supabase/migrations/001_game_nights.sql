create extension if not exists pgcrypto with schema extensions;

create table if not exists public.game_nights (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  share_code_hash text not null unique,
  host_token_hash text not null,
  status text not null default 'setup'
    check (status in ('setup', 'active', 'completed')),
  started_at timestamptz,
  completed_at timestamptz,
  check (
    (status = 'setup' and started_at is null and completed_at is null)
    or (status = 'active' and started_at is not null and completed_at is null)
    or (status = 'completed' and completed_at is not null)
  )
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  game_night_id uuid not null references public.game_nights(id) on delete cascade,
  display_name text not null check (
    display_name = btrim(display_name)
    and char_length(display_name) between 1 and 40
  ),
  score integer not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists participants_unique_night_name
  on public.participants (game_night_id, lower(btrim(display_name)));

create table if not exists public.mutation_requests (
  game_night_id uuid not null references public.game_nights(id) on delete cascade,
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 128),
  operation text not null,
  response jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_night_id, idempotency_key)
);

alter table public.game_nights enable row level security;
alter table public.participants enable row level security;
alter table public.mutation_requests enable row level security;

revoke all on public.game_nights, public.participants, public.mutation_requests
  from anon, authenticated;
grant all on public.game_nights, public.participants, public.mutation_requests
  to service_role;

create or replace function public.broadcast_game_night_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_night_id uuid;
  v_share_code_hash text;
begin
  if tg_table_name = 'game_nights' then
    v_game_night_id := new.id;
  else
    v_game_night_id := new.game_night_id;
  end if;

  select share_code_hash into v_share_code_hash
  from public.game_nights
  where id = v_game_night_id;

  if v_share_code_hash is not null then
    perform realtime.send(
      '{}'::jsonb,
      'state_changed',
      'game-night:' || v_share_code_hash,
      false
    );
  end if;
  return new;
end;
$$;

revoke all on function public.broadcast_game_night_change() from public, anon, authenticated;

create trigger game_nights_broadcast_change
  after insert or update on public.game_nights
  for each row execute function public.broadcast_game_night_change();
create trigger participants_broadcast_change
  after insert or update on public.participants
  for each row execute function public.broadcast_game_night_change();

create table if not exists public.rate_limits (
  bucket text primary key,
  hits integer not null,
  expires_at timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
grant all on public.rate_limits to service_role;

create or replace function public.check_game_night_creation_rate(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_hits integer;
begin
  v_bucket := encode(extensions.digest(coalesce(p_ip, 'unknown'), 'sha256'), 'hex');

  insert into public.rate_limits (bucket, hits, expires_at)
  values (v_bucket, 1, now() + interval '15 minutes')
  on conflict (bucket) do update
  set hits = case
        when public.rate_limits.expires_at <= now() then 1
        else public.rate_limits.hits + 1
      end,
      expires_at = case
        when public.rate_limits.expires_at <= now() then now() + interval '15 minutes'
        else public.rate_limits.expires_at
      end
  returning hits into v_hits;

  delete from public.rate_limits where expires_at < now() - interval '1 day';
  return v_hits <= 5;
end;
$$;

revoke all on function public.check_game_night_creation_rate(text) from public, anon, authenticated;
grant execute on function public.check_game_night_creation_rate(text) to service_role;
