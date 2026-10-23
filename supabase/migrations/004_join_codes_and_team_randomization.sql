create or replace function public.check_join_code_failure_rate(p_ip text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_hits integer;
begin
  v_bucket := 'join-code:' || encode(
    extensions.digest(coalesce(p_ip, 'unknown'), 'sha256'),
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

  return v_hits <= 10;
end;
$$;

revoke all on function public.check_join_code_failure_rate(text) from public, anon, authenticated;
grant execute on function public.check_join_code_failure_rate(text) to service_role;

create or replace function public.randomize_game_night_teams(p_game_night_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  perform 1
  from public.game_nights
  where id = p_game_night_id and status in ('setup', 'active')
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'EDITABLE_NIGHT_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.teams where game_night_id = p_game_night_id
  ) then
    raise exception using errcode = '22023', message = 'NO_TEAMS';
  end if;

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

revoke all on function public.randomize_game_night_teams(uuid) from public, anon, authenticated;
grant execute on function public.randomize_game_night_teams(uuid) to service_role;
