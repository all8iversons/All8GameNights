alter table public.participants
  add column removed_at timestamptz;

drop index public.participants_unique_night_name;
create unique index participants_unique_night_name
  on public.participants (game_night_id, lower(btrim(display_name)))
  where removed_at is null;

create index participants_active_night_created
  on public.participants (game_night_id, created_at)
  where removed_at is null;

create or replace function public.remove_game_night_participant(
  p_game_night_id uuid,
  p_participant_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;

  perform 1
  from public.participants
  where game_night_id = p_game_night_id
    and id = p_participant_id
    and removed_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  update public.challenge_rounds
  set finished_at = coalesce(finished_at, now()),
      timer_status = 'stopped',
      deadline_at = null,
      paused_remaining_seconds = null
  where game_night_id = p_game_night_id
    and participant_id = p_participant_id
    and finished_at is null;

  update public.participants
  set removed_at = now(), team_id = null
  where game_night_id = p_game_night_id
    and id = p_participant_id
    and removed_at is null;
end;
$$;

revoke all on function public.remove_game_night_participant(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_game_night_participant(uuid, uuid)
  to service_role;

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
  v_challenge public.challenges;
  v_saved public.mutation_requests;
begin
  perform 1 from public.game_nights
  where id = p_game_night_id and status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_NIGHT_NOT_FOUND';
  end if;

  perform 1 from public.participants
  where id = p_participant_id
    and game_night_id = p_game_night_id
    and removed_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  select * into v_saved from public.mutation_requests
  where game_night_id = p_game_night_id and idempotency_key = p_idempotency_key;
  if found then
    if v_saved.operation <> 'draw'
      or nullif(v_saved.response ->> 'participantId', '')::uuid is distinct from p_participant_id then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return (v_saved.response ->> 'roundId')::uuid;
  end if;

  select challenges.* into v_challenge
  from public.challenges as challenges
  where challenges.enabled
    and not exists (
      select 1 from public.challenge_rounds as rounds
      where rounds.game_night_id = p_game_night_id
        and rounds.challenge_id = challenges.id
    )
  order by random()
  limit 1;
  if not found then
    return null;
  end if;

  update public.challenge_rounds
  set finished_at = now(),
      timer_status = 'stopped',
      deadline_at = null,
      paused_remaining_seconds = null
  where game_night_id = p_game_night_id
    and participant_id = p_participant_id
    and finished_at is null;

  insert into public.challenge_rounds (game_night_id, participant_id, challenge_id)
  values (p_game_night_id, p_participant_id, v_challenge.id)
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

revoke all on function public.draw_unused_challenge(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.draw_unused_challenge(uuid, uuid, text)
  to service_role;

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

  select * into v_participant
  from public.participants
  where id = p_participant_id
    and game_night_id = p_game_night_id
    and removed_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  select * into v_saved from public.mutation_requests
  where game_night_id = p_game_night_id and idempotency_key = p_idempotency_key;
  if v_saved.idempotency_key is not null then
    if v_saved.operation <> 'score' then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_saved.response;
  end if;

  update public.participants
  set score = score + p_delta
  where id = p_participant_id
    and game_night_id = p_game_night_id
    and removed_at is null
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

revoke all on function public.apply_score_delta(uuid, uuid, integer, text)
  from public, anon, authenticated;
grant execute on function public.apply_score_delta(uuid, uuid, integer, text)
  to service_role;

create or replace function public.randomize_game_night_teams(p_game_night_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  perform 1 from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;
  if not exists (select 1 from public.teams where game_night_id = p_game_night_id) then
    raise exception using errcode = '22023', message = 'NO_TEAMS';
  end if;

  with ranked_participants as materialized (
    select id, row_number() over (order by random()) as player_rank
    from public.participants
    where game_night_id = p_game_night_id and removed_at is null
  ),
  ranked_teams as materialized (
    select id, row_number() over (order by random()) as team_rank, count(*) over () as team_count
    from public.teams
    where game_night_id = p_game_night_id
  )
  update public.participants as participant
  set team_id = team.id
  from ranked_participants as player
  cross join ranked_teams as team
  where participant.id = player.id
    and team.team_rank = ((player.player_rank - 1) % team.team_count) + 1;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.randomize_game_night_teams(uuid)
  from public, anon, authenticated;
grant execute on function public.randomize_game_night_teams(uuid)
  to service_role;

create or replace function public.generate_game_night_teams(
  p_game_night_id uuid,
  p_team_names text[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant_count integer;
  v_team_count integer;
  v_updated integer;
begin
  perform 1 from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;

  select count(*) into v_participant_count
  from public.participants
  where game_night_id = p_game_night_id and removed_at is null;

  v_team_count := coalesce(cardinality(p_team_names), 0);
  if v_participant_count = 0
    or v_team_count = 0
    or v_team_count > v_participant_count
    or exists (
      select 1 from unnest(p_team_names) as names(name)
      where name is null or name <> btrim(name) or char_length(name) not between 1 and 40
    )
    or (
      select count(distinct lower(name)) from unnest(p_team_names) as names(name)
    ) <> v_team_count then
    raise exception using errcode = '22023', message = 'INVALID_GENERATED_TEAMS';
  end if;

  update public.participants
  set team_id = null
  where game_night_id = p_game_night_id and removed_at is null;

  delete from public.teams where game_night_id = p_game_night_id;

  insert into public.teams (game_night_id, name)
  select p_game_night_id, name
  from unnest(p_team_names) with ordinality as names(name, team_order)
  order by team_order;

  with ranked_participants as materialized (
    select id, row_number() over (order by random()) as player_rank
    from public.participants
    where game_night_id = p_game_night_id and removed_at is null
  ),
  ranked_teams as materialized (
    select id, row_number() over (order by random()) as team_rank, count(*) over () as team_count
    from public.teams
    where game_night_id = p_game_night_id
  ),
  assignments as (
    select player.id as participant_id, team.id as team_id
    from ranked_participants as player
    cross join ranked_teams as team
    where team.team_rank = ((player.player_rank - 1) % team.team_count) + 1
  )
  update public.participants as participant
  set team_id = assignments.team_id
  from assignments
  where participant.id = assignments.participant_id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.generate_game_night_teams(uuid, text[])
  from public, anon, authenticated;
grant execute on function public.generate_game_night_teams(uuid, text[])
  to service_role;

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
  if not exists (
    select 1 from public.participants
    where game_night_id = p_game_night_id and removed_at is null
  ) then
    raise exception using errcode = '22023', message = 'EMPTY_ROSTER';
  end if;

  update public.challenge_rounds
  set timer_status = 'stopped', deadline_at = null, paused_remaining_seconds = null
  where game_night_id = p_game_night_id and timer_status in ('running', 'paused');
  update public.game_nights
  set status = 'completed', started_at = coalesce(started_at, now()), completed_at = now()
  where id = p_game_night_id
  returning * into v_night;
  return v_night;
end;
$$;

revoke all on function public.complete_game_night(uuid)
  from public, anon, authenticated;
grant execute on function public.complete_game_night(uuid)
  to service_role;

create or replace function public.broadcast_challenge_catalog_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_night record;
begin
  for v_night in
    select share_code_hash from public.game_nights
  loop
    perform realtime.send(
      '{}'::jsonb,
      'state_changed',
      'game-night:' || v_night.share_code_hash,
      false
    );
  end loop;
  return new;
end;
$$;

revoke all on function public.broadcast_challenge_catalog_change()
  from public, anon, authenticated;

create trigger challenges_broadcast_catalog_change
  after insert or update on public.challenges
  for each row execute function public.broadcast_challenge_catalog_change();
