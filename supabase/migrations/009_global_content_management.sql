create table public.team_name_pool (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  created_at timestamptz not null default now()
);

create unique index team_name_pool_unique_name
  on public.team_name_pool (lower(btrim(name)));

alter table public.team_name_pool enable row level security;
revoke all on public.team_name_pool from anon, authenticated;
grant all on public.team_name_pool to service_role;

insert into public.team_name_pool (name)
select adjective || ' ' || noun
from unnest(array[
  'Aurora', 'Nebula', 'Comet', 'Lunar', 'Nova',
  'Orbit', 'Cosmic', 'Solar', 'Stellar', 'Meteor'
]) as adjectives(adjective)
cross join unnest(array[
  'Voyagers', 'Pioneers', 'Navigators', 'Guardians', 'Rangers',
  'Explorers', 'Pathfinders', 'Trailblazers', 'Seekers', 'Astronauts'
]) as nouns(noun)
on conflict do nothing;
