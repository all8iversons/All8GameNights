import { constantTimeEqual } from '../_shared/capabilities.ts';
import { serviceClient } from '../_shared/game-night-auth.ts';
import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import {
  createChallengeWithClient,
  mapChallenge,
  readChallengeCatalogWithClient,
  updateChallengeWithClient,
} from './challenges.ts';

function requireAdmin(request: Request) {
  const configuredPassword = Deno.env.get('GAME_NIGHT_ADMIN_PASSWORD');
  if (!configuredPassword || configuredPassword.length < 32) {
    throw new HttpError(
      503,
      'ADMIN_NOT_CONFIGURED',
      'Global content management is unavailable because the server admin password is not configured.',
    );
  }
  const authorization = request.headers.get('authorization');
  const suppliedPassword = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!constantTimeEqual(suppliedPassword, configuredPassword)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'The admin password is invalid.');
  }
  return serviceClient();
}

function parseTeamName(value: unknown) {
  if (typeof value !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A team name is required.');
  }
  const name = value.trim();
  if (name.length < 1 || name.length > 40) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Team names must contain 1 to 40 characters.');
  }
  return name;
}

export async function manageGlobalContent(request: Request, path: string[]) {
  const client = requireAdmin(request);
  const [resource, id, action] = path;

  if (resource === 'challenges' && path.length === 1 && request.method === 'GET') {
    return readChallengeCatalogWithClient(client);
  }
  if (resource === 'challenges' && path.length === 1 && request.method === 'POST') {
    return createChallengeWithClient(request, client);
  }
  if (resource === 'challenges' && id && !action && request.method === 'POST') {
    return updateChallengeWithClient(request, client, id);
  }
  if (resource === 'challenges' && id && action === 'archive' && request.method === 'POST') {
    const { data, error } = await client
      .from('challenges')
      .update({ enabled: false })
      .eq('id', id)
      .select('id, name, instructions, enabled')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Challenge was not found.');
    return jsonResponse({ challenge: mapChallenge(data) });
  }
  if (resource === 'team-names' && path.length === 1 && request.method === 'GET') {
    const { data, error } = await client
      .from('team_name_pool')
      .select('id, name, created_at')
      .order('name');
    if (error) throw error;
    return jsonResponse({
      teamNames: (data ?? []).map(({ id, name, created_at }) => ({
        id,
        name,
        createdAt: created_at,
      })),
    });
  }
  if (resource === 'team-names' && path.length === 1 && request.method === 'POST') {
    const body = await readJson<{ name?: unknown }>(request);
    const { data, error } = await client
      .from('team_name_pool')
      .insert({ name: parseTeamName(body.name) })
      .select('id, name, created_at')
      .single();
    if (error?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_TEAM_NAME', 'A random team name with that value already exists.');
    }
    if (error) throw error;
    return jsonResponse(
      { teamName: { id: data.id, name: data.name, createdAt: data.created_at } },
      201,
    );
  }
  if (resource === 'team-names' && id && !action && request.method === 'POST') {
    const body = await readJson<{ name?: unknown }>(request);
    const { data, error } = await client
      .from('team_name_pool')
      .update({ name: parseTeamName(body.name) })
      .eq('id', id)
      .select('id, name, created_at')
      .maybeSingle();
    if (error?.code === '23505') {
      throw new HttpError(409, 'DUPLICATE_TEAM_NAME', 'A random team name with that value already exists.');
    }
    if (error) throw error;
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Team name was not found.');
    return jsonResponse({ teamName: { id: data.id, name: data.name, createdAt: data.created_at } });
  }
  if (resource === 'team-names' && id && action === 'remove' && request.method === 'POST') {
    const { data, error } = await client
      .from('team_name_pool')
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(404, 'NOT_FOUND', 'Team name was not found.');
    return jsonResponse({ removed: true });
  }

  throw new HttpError(404, 'NOT_FOUND', 'The requested global content operation was not found.');
}
