create or replace function public.trade_team_challenges(
  p_game_night_id uuid,
  p_first_participant_id uuid,
  p_second_participant_id uuid,
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_saved public.mutation_requests;
  v_first_round public.challenge_rounds;
  v_second_round public.challenge_rounds;
  v_first_team_id uuid;
  v_second_team_id uuid;
begin
  if p_first_participant_id is null
    or p_second_participant_id is null
    or p_first_participant_id = p_second_participant_id then
    raise exception using errcode = '22023', message = 'PLAYERS_NOT_TEAMMATES';
  end if;
  if p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128 then
    raise exception using errcode = '22023', message = 'INVALID_IDEMPOTENCY_KEY';
  end if;

  perform 1
  from public.game_nights
  where id = p_game_night_id and status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_NIGHT_NOT_FOUND';
  end if;

  select * into v_saved
  from public.mutation_requests
  where game_night_id = p_game_night_id and idempotency_key = p_idempotency_key;
  if found then
    if v_saved.operation <> 'challenge_trade'
      or (v_saved.response ->> 'firstParticipantId')::uuid is distinct from p_first_participant_id
      or (v_saved.response ->> 'secondParticipantId')::uuid is distinct from p_second_participant_id then
      raise exception using errcode = '23505', message = 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return true;
  end if;

  select team_id into v_first_team_id
  from public.participants
  where id = p_first_participant_id and game_night_id = p_game_night_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  select team_id into v_second_team_id
  from public.participants
  where id = p_second_participant_id and game_night_id = p_game_night_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  if v_first_team_id is null or v_first_team_id <> v_second_team_id then
    raise exception using errcode = '22023', message = 'PLAYERS_NOT_TEAMMATES';
  end if;

  select * into v_first_round
  from public.challenge_rounds
  where game_night_id = p_game_night_id
    and participant_id = p_first_participant_id
    and finished_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CHALLENGE_NOT_AVAILABLE';
  end if;

  select * into v_second_round
  from public.challenge_rounds
  where game_night_id = p_game_night_id
    and participant_id = p_second_participant_id
    and finished_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CHALLENGE_NOT_AVAILABLE';
  end if;

  if v_first_round.timer_status = 'running' or v_second_round.timer_status = 'running' then
    raise exception using errcode = '22023', message = 'CHALLENGE_TIMER_RUNNING';
  end if;

  update public.challenge_rounds
  set finished_at = now()
  where id in (v_first_round.id, v_second_round.id);

  update public.challenge_rounds
  set participant_id = case
    when id = v_first_round.id then p_second_participant_id
    else p_first_participant_id
  end
  where id in (v_first_round.id, v_second_round.id);

  update public.challenge_rounds
  set finished_at = null
  where id in (v_first_round.id, v_second_round.id);

  insert into public.mutation_requests (game_night_id, idempotency_key, operation, response)
  values (
    p_game_night_id,
    p_idempotency_key,
    'challenge_trade',
    jsonb_build_object(
      'firstParticipantId', p_first_participant_id,
      'secondParticipantId', p_second_participant_id
    )
  );

  return true;
end;
$$;

revoke all on function public.trade_team_challenges(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.trade_team_challenges(uuid, uuid, uuid, text)
  to service_role;
