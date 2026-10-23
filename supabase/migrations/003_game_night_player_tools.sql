create table public.teams (
  id uuid primary key default gen_random_uuid(),
  game_night_id uuid not null references public.game_nights(id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (game_night_id, id)
);

create unique index teams_unique_night_name
  on public.teams (game_night_id, lower(btrim(name)));

alter table public.participants
  add column team_id uuid,
  add constraint participants_unique_night_id unique (game_night_id, id),
  add constraint participants_team_same_night
    foreign key (game_night_id, team_id)
    references public.teams (game_night_id, id);

alter table public.challenge_rounds
  add column participant_id uuid,
  add column finished_at timestamptz;

with first_player as (
  select distinct on (game_night_id) game_night_id, id
  from public.participants
  order by game_night_id, created_at, id
),
ranked_rounds as (
  select id, row_number() over (
    partition by game_night_id
    order by selected_at desc, id desc
  ) as round_rank
  from public.challenge_rounds
)
update public.challenge_rounds as rounds
set participant_id = first_player.id,
    finished_at = case
      when ranked_rounds.round_rank = 1 then null
      else coalesce(rounds.finished_at, rounds.selected_at)
    end
from first_player, ranked_rounds
where rounds.id = ranked_rounds.id
  and rounds.game_night_id = first_player.game_night_id;

alter table public.challenge_rounds
  alter column participant_id set not null,
  add constraint challenge_rounds_participant_same_night
    foreign key (game_night_id, participant_id)
    references public.participants (game_night_id, id);

create unique index challenge_rounds_one_unfinished_per_player
  on public.challenge_rounds (game_night_id, participant_id)
  where finished_at is null;

create index challenge_rounds_player_selected
  on public.challenge_rounds (game_night_id, participant_id, selected_at desc);

alter table public.teams enable row level security;
revoke all on public.teams from anon, authenticated;
grant all on public.teams to service_role;

create or replace function public.broadcast_game_night_team_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_game_night_id uuid;
  v_share_code_hash text;
begin
  if tg_op = 'DELETE' then
    v_game_night_id := old.game_night_id;
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

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.broadcast_game_night_team_change() from public, anon, authenticated;

create trigger teams_broadcast_change
  after insert or update or delete on public.teams
  for each row execute function public.broadcast_game_night_team_change();

create or replace function public.draw_unused_challenge(
  p_game_night_id uuid,
  p_participant_id uuid,
  p_idempotency_key text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.challenge_rounds;
  v_saved public.mutation_requests;
begin
  perform 1 from public.game_nights
  where id = p_game_night_id and status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_NIGHT_NOT_FOUND';
  end if;

  perform 1 from public.participants
  where id = p_participant_id and game_night_id = p_game_night_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  select * into v_saved from public.mutation_requests
  where game_night_id = p_game_night_id and idempotency_key = p_idempotency_key;
  if found then
    if v_saved.operation <> 'draw' then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    if (nullif(v_saved.response ->> 'participantId', '')::uuid is distinct from p_participant_id) then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return (v_saved.response ->> 'roundId')::uuid;
  end if;

  if exists (
    select 1 from public.challenge_rounds
    where game_night_id = p_game_night_id
      and participant_id = p_participant_id
      and finished_at is null
  ) then
    raise exception using errcode = '23505', message = 'PLAYER_HAS_UNFINISHED_ROUND';
  end if;

  insert into public.challenge_rounds (game_night_id, participant_id, challenge_id)
  select p_game_night_id, p_participant_id, challenges.id
  from public.challenges as challenges
  where challenges.enabled
    and not exists (
      select 1 from public.challenge_rounds as rounds
      where rounds.game_night_id = p_game_night_id
        and rounds.challenge_id = challenges.id
    )
  order by random()
  limit 1
  returning * into v_round;

  if v_round.id is not null then
    insert into public.mutation_requests (game_night_id, idempotency_key, operation, response)
    values (
      p_game_night_id,
      p_idempotency_key,
      'draw',
      jsonb_build_object('roundId', v_round.id, 'participantId', p_participant_id)
    );
  end if;
  return v_round.id;
end;
$$;

revoke all on function public.draw_unused_challenge(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.draw_unused_challenge(uuid, uuid, text) to service_role;

create or replace function public.apply_timer_action(
  p_round_id uuid,
  p_game_night_id uuid,
  p_action text,
  p_duration_seconds integer default null
)
returns public.challenge_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.challenge_rounds;
  v_remaining integer;
begin
  perform 1 from public.game_nights
  where id = p_game_night_id and status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_NIGHT_NOT_FOUND';
  end if;

  select * into v_round from public.challenge_rounds
  where id = p_round_id and game_night_id = p_game_night_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ROUND_NOT_FOUND';
  end if;
  if v_round.finished_at is not null then
    raise exception using errcode = '22023', message = 'ROUND_ALREADY_FINISHED';
  end if;

  if v_round.timer_status = 'running' and v_round.deadline_at <= now() then
    update public.challenge_rounds
    set timer_status = 'expired', deadline_at = null
    where id = p_round_id returning * into v_round;
  end if;

  if p_action = 'start' then
    if v_round.timer_status not in ('ready', 'expired')
      or p_duration_seconds is null or p_duration_seconds <= 0 then
      raise exception using errcode = '22023', message = 'INVALID_TIMER_START';
    end if;
    update public.challenge_rounds
    set timer_status = 'running',
        duration_seconds = p_duration_seconds,
        deadline_at = now() + make_interval(secs => p_duration_seconds),
        paused_remaining_seconds = null
    where id = p_round_id returning * into v_round;
  elsif p_action = 'pause' then
    if v_round.timer_status <> 'running' then
      raise exception using errcode = '22023', message = 'INVALID_TIMER_PAUSE';
    end if;
    v_remaining := greatest(0, ceil(extract(epoch from (v_round.deadline_at - now())))::integer);
    update public.challenge_rounds
    set timer_status = 'paused', deadline_at = null, paused_remaining_seconds = v_remaining
    where id = p_round_id returning * into v_round;
  elsif p_action = 'resume' then
    if v_round.timer_status <> 'paused' or coalesce(v_round.paused_remaining_seconds, 0) <= 0 then
      raise exception using errcode = '22023', message = 'INVALID_TIMER_RESUME';
    end if;
    update public.challenge_rounds
    set timer_status = 'running',
        deadline_at = now() + make_interval(secs => v_round.paused_remaining_seconds),
        paused_remaining_seconds = null
    where id = p_round_id returning * into v_round;
  elsif p_action = 'reset' then
    if v_round.timer_status = 'stopped' then
      raise exception using errcode = '22023', message = 'INVALID_TIMER_RESET';
    end if;
    update public.challenge_rounds
    set timer_status = 'ready', deadline_at = null, paused_remaining_seconds = null
    where id = p_round_id returning * into v_round;
  elsif p_action = 'finish' then
    update public.challenge_rounds
    set finished_at = now(),
        timer_status = 'stopped',
        deadline_at = null,
        paused_remaining_seconds = null
    where id = p_round_id returning * into v_round;
  else
    raise exception using errcode = '22023', message = 'INVALID_TIMER_ACTION';
  end if;

  return v_round;
end;
$$;

revoke all on function public.apply_timer_action(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_timer_action(uuid, uuid, text, integer) to service_role;

create or replace function public.check_player_score_rate(
  p_ip text,
  p_game_night_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_hits integer;
begin
  v_bucket := 'score:' || encode(
    extensions.digest(coalesce(p_ip, 'unknown') || ':' || p_game_night_id::text, 'sha256'),
    'hex'
  );

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

  return v_hits <= 120;
end;
$$;

revoke all on function public.check_player_score_rate(text, uuid) from public, anon, authenticated;
grant execute on function public.check_player_score_rate(text, uuid) to service_role;

create or replace function public.remove_game_night_team(
  p_game_night_id uuid,
  p_team_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;

  update public.participants
  set team_id = null
  where game_night_id = p_game_night_id and team_id = p_team_id;

  delete from public.teams
  where id = p_team_id and game_night_id = p_game_night_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'TEAM_NOT_FOUND';
  end if;
end;
$$;

revoke all on function public.remove_game_night_team(uuid, uuid) from public, anon, authenticated;
grant execute on function public.remove_game_night_team(uuid, uuid) to service_role;
