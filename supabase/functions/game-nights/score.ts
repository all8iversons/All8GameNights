import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { resolveNight } from './shared.ts';
import { mapParticipant } from './shared.ts';

export async function updateScore(request: Request, spectatorCode: string, participantId: string) {
  const { client, night } = await resolveNight(request, spectatorCode);
  if (night.status !== 'active') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'Scores can only change during an active game.',
    );
  }
  const body = await readJson<{ delta?: unknown; idempotencyKey?: unknown }>(request);
  if (!Number.isInteger(body.delta) || body.delta === 0 || Math.abs(Number(body.delta)) > 10000) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Score changes must be a non-zero whole number between -10,000 and 10,000.',
    );
  }
  if (
    typeof body.idempotencyKey !== 'string' ||
    body.idempotencyKey.length > 128 ||
    !body.idempotencyKey
  ) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'An idempotency key is required.');
  }
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const { data: allowed, error: rateError } = await client.rpc('check_player_score_rate', {
    p_ip: ip,
    p_game_night_id: night.id,
  });
  if (rateError) throw rateError;
  if (!allowed) {
    throw new HttpError(429, 'RATE_LIMITED', 'Too many score updates. Try again later.');
  }
  const { data, error } = await client.rpc('apply_score_delta', {
    p_game_night_id: night.id,
    p_participant_id: participantId,
    p_delta: body.delta,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) {
    if (error.message.includes('PARTICIPANT_NOT_FOUND')) {
      throw new HttpError(404, 'NOT_FOUND', 'Participant was not found.');
    }
    if (error.message.includes('IDEMPOTENCY_KEY_REUSED')) {
      throw new HttpError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'This request key was used for another operation.',
      );
    }
    throw error;
  }
  return jsonResponse({ participant: mapParticipant(data) });
}
