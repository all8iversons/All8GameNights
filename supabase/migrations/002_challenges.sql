create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(btrim(name)) between 1 and 100),
  instructions text not null check (char_length(btrim(instructions)) between 1 and 1000),
  enabled boolean not null default true
);

insert into public.challenges (name, instructions, enabled) values
  ('No-HUD Run', 'Complete a short section of a game with the heads-up display hidden or disabled.', true),
  ('One-Life Challenge', 'Play for the round without using a continue or restarting after a loss.', true),
  ('Random Loadout', 'Use a randomly selected weapon, character, or equipment setup for one match.', true),
  ('Speedrun Sprint', 'Complete a familiar level or objective as quickly as possible.', true),
  ('Blind Controls', 'Ask another player to choose your controls or key bindings for one short round.', true),
  ('Pacifist Attempt', 'Complete a suitable objective while avoiding optional combat.', true),
  ('Mirror Match', 'Use the same character, class, or loadout as your opponent for one round.', true),
  ('Low-Level Victory', 'Attempt a suitable objective while avoiding optional upgrades or levels.', true)
on conflict (name) do nothing;

create table if not exists public.challenge_rounds (
  id uuid primary key default gen_random_uuid(),
  game_night_id uuid not null references public.game_nights(id) on delete cascade,
  challenge_id uuid not null references public.challenges(id),
  selected_at timestamptz not null default now(),
  timer_status text not null default 'ready'
    check (timer_status in ('ready', 'running', 'paused', 'expired', 'stopped')),
  duration_seconds integer check (duration_seconds is null or duration_seconds > 0),
  deadline_at timestamptz,
  paused_remaining_seconds integer
    check (paused_remaining_seconds is null or paused_remaining_seconds >= 0),
  unique (game_night_id, challenge_id)
);

create index if not exists challenge_rounds_night_selected
  on public.challenge_rounds (game_night_id, selected_at);

create trigger challenge_rounds_broadcast_change
  after insert or update on public.challenge_rounds
  for each row execute function public.broadcast_game_night_change();

alter table public.challenges enable row level security;
alter table public.challenge_rounds enable row level security;

revoke all on public.challenges, public.challenge_rounds, public.rate_limits
  from anon, authenticated;
grant all on public.challenges, public.challenge_rounds, public.rate_limits
  to service_role;

create or replace function public.draw_unused_challenge(
  p_game_night_id uuid,
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

  select * into v_saved from public.mutation_requests
  where game_night_id = p_game_night_id and idempotency_key = p_idempotency_key;
  if found then
    if v_saved.operation <> 'draw' then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return (v_saved.response ->> 'roundId')::uuid;
  end if;

  insert into public.challenge_rounds (game_night_id, challenge_id)
  select p_game_night_id, challenges.id
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
    update public.challenge_rounds
    set timer_status = 'stopped', deadline_at = null, paused_remaining_seconds = null
    where game_night_id = p_game_night_id
      and id <> v_round.id
      and timer_status = 'running';
    insert into public.mutation_requests (game_night_id, idempotency_key, operation, response)
    values (
      p_game_night_id,
      p_idempotency_key,
      'draw',
      jsonb_build_object('roundId', v_round.id)
    );
  end if;
  return v_round.id;
end;
$$;

revoke all on function public.draw_unused_challenge(uuid, text) from public, anon, authenticated;
grant execute on function public.draw_unused_challenge(uuid, text) to service_role;

create or replace function public.apply_score_delta(
  p_game_night_id uuid,
  p_participant_id uuid,
  p_delta integer,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved public.mutation_requests;
  v_participant public.participants;
  v_response jsonb;
begin
  perform 1 from public.game_nights
    where id = p_game_night_id and status = 'active'
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_NIGHT_NOT_FOUND';
  end if;

  select * into v_saved from public.mutation_requests
  where game_night_id = p_game_night_id and idempotency_key = p_idempotency_key;
  if found then
    if v_saved.operation <> 'score' then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_saved.response;
  end if;

  update public.participants
  set score = score + p_delta
  where id = p_participant_id and game_night_id = p_game_night_id
  returning * into v_participant;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  v_response := jsonb_build_object(
    'id', v_participant.id,
    'gameNightId', v_participant.game_night_id,
    'displayName', v_participant.display_name,
    'score', v_participant.score,
    'createdAt', v_participant.created_at
  );
  insert into public.mutation_requests (game_night_id, idempotency_key, operation, response)
  values (p_game_night_id, p_idempotency_key, 'score', v_response);
  return v_response;
end;
$$;

revoke all on function public.apply_score_delta(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.apply_score_delta(uuid, uuid, integer, text) to service_role;

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

  if v_round.timer_status = 'running' and v_round.deadline_at <= now() then
    update public.challenge_rounds set timer_status = 'expired', deadline_at = null
    where id = p_round_id returning * into v_round;
  end if;

  if p_action = 'start' then
    if v_round.timer_status not in ('ready', 'expired') or p_duration_seconds is null or p_duration_seconds <= 0 then
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
  else
    raise exception using errcode = '22023', message = 'INVALID_TIMER_ACTION';
  end if;

  return v_round;
end;
$$;

revoke all on function public.apply_timer_action(uuid, uuid, text, integer) from public, anon, authenticated;
grant execute on function public.apply_timer_action(uuid, uuid, text, integer) to service_role;

create or replace function public.complete_game_night(p_game_night_id uuid)
returns public.game_nights
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_night public.game_nights;
begin
  select * into v_night from public.game_nights
  where id = p_game_night_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'NIGHT_NOT_FOUND';
  end if;
  if v_night.status = 'completed' then
    return v_night;
  end if;
  if not exists (select 1 from public.participants where game_night_id = p_game_night_id) then
    raise exception using errcode = '22023', message = 'EMPTY_ROSTER';
  end if;
  update public.challenge_rounds
  set timer_status = 'stopped', deadline_at = null, paused_remaining_seconds = null
  where game_night_id = p_game_night_id and timer_status in ('running', 'paused');
  update public.game_nights
  set status = 'completed', started_at = coalesce(started_at, now()), completed_at = now()
  where id = p_game_night_id returning * into v_night;
  return v_night;
end;
$$;

revoke all on function public.complete_game_night(uuid) from public, anon, authenticated;
grant execute on function public.complete_game_night(uuid) to service_role;
