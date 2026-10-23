import { generateCapability, generateJoinCode, hashCapability } from '../_shared/capabilities.ts';
import {
  errorResponse,
  HttpError,
  jsonResponse,
  optionsResponse,
  readJson,
} from '../_shared/http.ts';
import { serviceClient } from '../_shared/game-night-auth.ts';
import { getSnapshot, mapParticipant, requireHost, resolveNight } from './shared.ts';
import { startGameNight } from './start.ts';
import { addParticipant } from './participants.ts';
import { updateScore } from './score.ts';
import { completeGameNight } from './complete.ts';
import { readGameNight } from './read.ts';
import { drawChallenge } from './draw-challenge.ts';
import { controlTimer } from './challenge-timer.ts';
import {
  assignParticipantToTeam,
  createTeam,
  generateTeams,
  randomizeTeams,
  updateTeam,
} from './teams.ts';

export { getSnapshot, mapParticipant, requireHost, resolveNight };

async function createGameNight(request: Request) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const client = serviceClient();
  const { data: allowed, error: rateError } = await client.rpc('check_game_night_creation_rate', {
    p_ip: ip,
  });
  if (rateError) throw rateError;
  if (!allowed)
    throw new HttpError(429, 'RATE_LIMITED', 'Too many game nights were created. Try again later.');

  const hostCapability = generateCapability();
  let spectatorCode = '';
  let night: { id: string; status: string; created_at: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    spectatorCode = generateJoinCode();
    const { data, error } = await client
      .from('game_nights')
      .insert({
        host_token_hash: await hashCapability(hostCapability),
        share_code_hash: await hashCapability(spectatorCode),
      })
      .select('id, status, created_at')
      .single();
    if (!error) {
      night = data;
      break;
    }
    if (error.code !== '23505') throw error;
  }
  if (!night) {
    throw new HttpError(
      503,
      'JOIN_CODE_UNAVAILABLE',
      'Could not reserve a join code. Please try creating the game again.',
    );
  }
  return jsonResponse(
    {
      gameNight: { id: night.id, status: night.status, createdAt: night.created_at },
      hostCapability,
      spectatorCode,
    },
    201,
  );
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return optionsResponse();
  const { pathname } = new URL(request.url);
  const pathParts = pathname.split('/').filter(Boolean);
  const functionIndex = pathParts.indexOf('game-nights');
  const parts = functionIndex === -1 ? pathParts : pathParts.slice(functionIndex + 1);

  if (request.method === 'POST' && parts.length === 0) {
    await readJson<Record<string, never>>(request);
    return createGameNight(request);
  }

  const [spectatorCode, resource, id, action] = parts;
  if (!spectatorCode) throw new HttpError(404, 'NOT_FOUND', 'This game night could not be found.');
  if (request.method === 'GET' && parts.length === 1) return readGameNight(request, spectatorCode);

  if (request.method !== 'POST') {
    throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'This method is not supported.');
  }

  if (resource === 'participants' && !id) return addParticipant(request, spectatorCode);
  if (resource === 'start') return startGameNight(request, spectatorCode);
  if (resource === 'teams' && !id) return createTeam(request, spectatorCode);
  if (resource === 'teams' && id === 'randomize') return randomizeTeams(request, spectatorCode);
  if (resource === 'teams' && id === 'generate') return generateTeams(request, spectatorCode);
  if (resource === 'teams' && id) return updateTeam(request, spectatorCode, id, action);
  if (resource === 'participants' && id && action === 'team') {
    return assignParticipantToTeam(request, spectatorCode, id);
  }
  if (resource === 'participants' && id && action === 'score') {
    return updateScore(request, spectatorCode, id);
  }
  if (resource === 'challenge-draws') return drawChallenge(request, spectatorCode);
  if (resource === 'challenge-rounds' && id && action === 'timer') {
    return controlTimer(request, spectatorCode, id);
  }
  if (resource === 'complete') return completeGameNight(request, spectatorCode);
  throw new HttpError(404, 'NOT_FOUND', 'The requested game-night operation was not found.');
}

Deno.serve(async (request) => {
  try {
    return await handle(request);
  } catch (error) {
    return errorResponse(error);
  }
});
