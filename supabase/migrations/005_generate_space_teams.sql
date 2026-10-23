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
  perform 1
  from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;

  select count(*) into v_participant_count
  from public.participants
  where game_night_id = p_game_night_id;

  v_team_count := coalesce(cardinality(p_team_names), 0);
  if v_participant_count = 0
    or v_team_count = 0
    or v_team_count > v_participant_count
    or exists (
      select 1
      from unnest(p_team_names) as names(name)
      where name is null or name <> btrim(name) or char_length(name) not between 1 and 40
    )
    or (
      select count(distinct lower(name)) from unnest(p_team_names) as names(name)
    ) <> v_team_count then
    raise exception using errcode = '22023', message = 'INVALID_GENERATED_TEAMS';
  end if;

  update public.participants
  set team_id = null
  where game_night_id = p_game_night_id;

  delete from public.teams
  where game_night_id = p_game_night_id;

  insert into public.teams (game_night_id, name)
  select p_game_night_id, name
  from unnest(p_team_names) with ordinality as names(name, team_order)
  order by team_order;

  with ranked_participants as materialized (
    select id, row_number() over (order by random()) as player_rank
    from public.participants
    where game_night_id = p_game_night_id
  ),
  ranked_teams as materialized (
    select
      id,
      row_number() over (order by random()) as team_rank,
      count(*) over () as team_count
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

revoke all on function public.generate_game_night_teams(uuid, text[]) from public, anon, authenticated;
grant execute on function public.generate_game_night_teams(uuid, text[]) to service_role;
