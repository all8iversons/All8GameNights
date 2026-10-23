create or replace function public.undo_finish_game_night_challenge(
  p_game_night_id uuid,
  p_round_id uuid
)
returns public.challenge_rounds
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round public.challenge_rounds;
begin
  perform 1
  from public.game_nights
  where id = p_game_night_id and status = 'active'
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ACTIVE_NIGHT_NOT_FOUND';
  end if;

  select * into v_round
  from public.challenge_rounds
  where id = p_round_id and game_night_id = p_game_night_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'ROUND_NOT_FOUND';
  end if;
  if v_round.finished_at is null then
    raise exception using errcode = '22023', message = 'ROUND_NOT_FINISHED';
  end if;

  perform 1
  from public.participants
  where id = v_round.participant_id
    and game_night_id = p_game_night_id
    and removed_at is null;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.challenge_rounds
    where game_night_id = p_game_night_id
      and participant_id = v_round.participant_id
      and finished_at is null
  ) or exists (
    select 1
    from public.challenge_rounds
    where game_night_id = p_game_night_id
      and participant_id = v_round.participant_id
      and (selected_at, id) > (v_round.selected_at, v_round.id)
  ) then
    raise exception using errcode = '22023', message = 'UNDO_NOT_AVAILABLE';
  end if;

  update public.challenge_rounds
  set finished_at = null,
      timer_status = 'ready',
      deadline_at = null,
      paused_remaining_seconds = null
  where id = p_round_id
  returning * into v_round;

  return v_round;
end;
$$;

revoke all on function public.undo_finish_game_night_challenge(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.undo_finish_game_night_challenge(uuid, uuid)
  to service_role;

create or replace function public.rename_game_night_participant(
  p_game_night_id uuid,
  p_participant_id uuid,
  p_display_name text
)
returns public.participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_participant public.participants;
begin
  perform 1
  from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id
    and game_night_id = p_game_night_id
    and removed_at is null
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'PARTICIPANT_NOT_FOUND';
  end if;

  update public.participants
  set display_name = p_display_name
  where id = p_participant_id
  returning * into v_participant;
  return v_participant;
end;
$$;

revoke all on function public.rename_game_night_participant(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.rename_game_night_participant(uuid, uuid, text)
  to service_role;
