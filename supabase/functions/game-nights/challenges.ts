import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { requireHost } from './shared.ts';

interface ChallengeInput {
  name?: unknown;
  instructions?: unknown;
  enabled?: unknown;
}

function parseChallenge(body: ChallengeInput) {
  if (typeof body.name !== 'string' || typeof body.instructions !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Challenge name and instructions are required.');
  }
  const name = body.name.trim();
  const instructions = body.instructions.trim();
  if (name.length < 1 || name.length > 100) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Challenge names must be 1 to 100 characters.');
  }
  if (instructions.length < 1 || instructions.length > 1000) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Challenge instructions must be 1 to 1,000 characters.',
    );
  }
  if (body.enabled !== undefined && typeof body.enabled !== 'boolean') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Challenge enabled must be true or false.');
  }
  return { name, instructions, enabled: body.enabled ?? true };
}

function mapChallenge(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    instructions: row.instructions,
    enabled: row.enabled,
  };
}

export async function readChallengeCatalog(request: Request, spectatorCode: string) {
  const { client } = await requireHost(request, spectatorCode);
  const { data, error } = await client
    .from('challenges')
    .select('id, name, instructions, enabled')
    .order('name');
  if (error) throw error;
  return jsonResponse({ challenges: (data ?? []).map(mapChallenge) });
}

export async function createChallenge(request: Request, spectatorCode: string) {
  const { client } = await requireHost(request, spectatorCode);
  const body = await readJson<ChallengeInput>(request);
  const { data, error } = await client
    .from('challenges')
    .insert(parseChallenge(body))
    .select('id, name, instructions, enabled')
    .single();
  if (error?.code === '23505') {
    throw new HttpError(409, 'DUPLICATE_CHALLENGE', 'A challenge with that name already exists.');
  }
  if (error) throw error;
  return jsonResponse({ challenge: mapChallenge(data) }, 201);
}

export async function updateChallenge(
  request: Request,
  spectatorCode: string,
  challengeId: string,
) {
  const { client } = await requireHost(request, spectatorCode);
  const body = await readJson<ChallengeInput>(request);
  const { data, error } = await client
    .from('challenges')
    .update(parseChallenge(body))
    .eq('id', challengeId)
    .select('id, name, instructions, enabled')
    .maybeSingle();
  if (error?.code === '23505') {
    throw new HttpError(409, 'DUPLICATE_CHALLENGE', 'A challenge with that name already exists.');
  }
  if (error) throw error;
  if (!data) throw new HttpError(404, 'NOT_FOUND', 'Challenge was not found.');
  return jsonResponse({ challenge: mapChallenge(data) });
}
