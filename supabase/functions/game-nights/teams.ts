import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { serviceClient } from '../_shared/game-night-auth.ts';
import { mapTeam, requireHost } from './shared.ts';

type DatabaseClient = ReturnType<typeof serviceClient>;

async function requireEditableHost(request: Request, spectatorCode: string) {
  const { client, night, authorized } = await requireHost(request, spectatorCode);
  if (authorized.status !== 'setup' && authorized.status !== 'active') {
    throw new HttpError(409, 'NIGHT_COMPLETED', 'Completed game nights cannot be changed.');
  }
  return { client, night };
}

function parseTeamName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A team name is required.');
  }
  const name = value.trim();
  if (name.length < 1 || name.length > 40) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Team names must contain 1 to 40 characters.');
  }
  return name;
}

export async function createTeam(request: Request, spectatorCode: string) {
  const { client, night } = await requireEditableHost(request, spectatorCode);
  const body = await readJson<{ name?: unknown }>(request);
  const { data: team, error } = await client
    .from('teams')
    .insert({ game_night_id: night.id, name: parseTeamName(body.name) })
    .select('*')
    .single();
  if (error?.code === '23505') {
    throw new HttpError(409, 'DUPLICATE_TEAM', 'A team with that name already exists.');
  }
  if (error) throw error;
  return jsonResponse({ team: mapTeam(team) }, 201);
}

export async function randomizeTeams(request: Request, spectatorCode: string) {
  const { client, night } = await requireEditableHost(request, spectatorCode);
  const { data: updatedCount, error } = await client.rpc('randomize_game_night_teams', {
    p_game_night_id: night.id,
  });
  if (error?.message.includes('NO_TEAMS')) {
    throw new HttpError(409, 'NO_TEAMS', 'Create at least one team before randomizing players.');
  }
  if (error) throw error;
  return jsonResponse({ updatedCount });
}

async function generateSpaceTeamNames(client: DatabaseClient, count: number) {
  const { data, error } = await client.from('team_name_pool').select('name');
  if (error) throw error;
  const names = (data ?? []).map(({ name }) => name);
  if (names.length === 0) {
    throw new HttpError(
      409,
      'TEAM_NAME_POOL_EMPTY',
      'Add at least one random team name before generating teams.',
    );
  }
  for (let index = names.length - 1; index > 0; index -= 1) {
    const random = new Uint32Array(1);
    crypto.getRandomValues(random);
    const swapIndex = random[0] % (index + 1);
    [names[index], names[swapIndex]] = [names[swapIndex], names[index]];
  }
  return Array.from({ length: count }, (_, index) => {
    const name = names[index % names.length];
    const suffix = Math.floor(index / names.length);
    if (suffix === 0) return name;
    const suffixText = ` ${suffix + 1}`;
    return `${name.slice(0, 40 - suffixText.length)}${suffixText}`;
  });
}

export async function generateTeams(request: Request, spectatorCode: string) {
  const { client, night } = await requireEditableHost(request, spectatorCode);
  const body = await readJson<{ mode?: unknown; count?: unknown }>(request);
  if (
    (body.mode !== 'team_count' && body.mode !== 'players_per_team') ||
    !Number.isInteger(body.count) ||
    Number(body.count) < 1
  ) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a valid team setup and positive number.');
  }

  const { count: participantCount, error: participantError } = await client
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('game_night_id', night.id)
    .is('removed_at', null);
  if (participantError) throw participantError;
  if (!participantCount) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Add at least one player before generating teams.',
    );
  }
  if (Number(body.count) > participantCount) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'The team count or players per team cannot exceed the number of players.',
    );
  }

  const teamCount =
    body.mode === 'team_count'
      ? Number(body.count)
      : Math.ceil(participantCount / Number(body.count));
  const teamNames = await generateSpaceTeamNames(client, teamCount);
  const { data: updatedCount, error } = await client.rpc('generate_game_night_teams', {
    p_game_night_id: night.id,
    p_team_names: teamNames,
  });
  if (error?.message.includes('INVALID_GENERATED_TEAMS')) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'The player roster changed. Refresh the game night and try generating teams again.',
    );
  }
  if (error) throw error;
  return jsonResponse({ teamCount: teamNames.length, updatedCount });
}

export async function updateTeam(
  request: Request,
  spectatorCode: string,
  teamId: string,
  action?: string,
) {
  const { client, night } = await requireEditableHost(request, spectatorCode);
  if (action === 'delete') {
    const { error } = await client.rpc('remove_game_night_team', {
      p_game_night_id: night.id,
      p_team_id: teamId,
    });
    if (error?.message.includes('TEAM_NOT_FOUND')) {
      throw new HttpError(404, 'NOT_FOUND', 'Team was not found.');
    }
    if (error) throw error;
    return jsonResponse({ deleted: true });
  }

  const body = await readJson<{ name?: unknown }>(request);
  const { data: team, error } = await client
    .from('teams')
    .update({ name: parseTeamName(body.name) })
    .eq('game_night_id', night.id)
    .eq('id', teamId)
    .select('*')
    .maybeSingle();
  if (error?.code === '23505') {
    throw new HttpError(409, 'DUPLICATE_TEAM', 'A team with that name already exists.');
  }
  if (error) throw error;
  if (!team) throw new HttpError(404, 'NOT_FOUND', 'Team was not found.');
  return jsonResponse({ team: mapTeam(team) });
}

export async function assignParticipantToTeam(
  request: Request,
  spectatorCode: string,
  participantId: string,
) {
  const { client, night } = await requireEditableHost(request, spectatorCode);
  const body = await readJson<{ teamId?: unknown }>(request);
  if (body.teamId !== null && typeof body.teamId !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a team or select Unassigned.');
  }

  const { data: participant, error } = await client
    .from('participants')
    .update({ team_id: body.teamId })
    .eq('game_night_id', night.id)
    .eq('id', participantId)
    .is('removed_at', null)
    .select('*')
    .maybeSingle();
  if (error?.code === '23503') {
    throw new HttpError(404, 'NOT_FOUND', 'Team was not found in this game night.');
  }
  if (error) throw error;
  if (!participant) throw new HttpError(404, 'NOT_FOUND', 'Participant was not found.');
  return jsonResponse({
    participant: {
      id: participant.id,
      gameNightId: participant.game_night_id,
      displayName: participant.display_name,
      score: participant.score,
      teamId: participant.team_id,
      createdAt: participant.created_at,
    },
  });
}
