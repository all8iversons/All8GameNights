import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { resolveNight } from './shared.ts';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function tradeChallenges(request: Request, spectatorCode: string) {
  const { client, night } = await resolveNight(request, spectatorCode);
  if (night.status !== 'active') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'Challenges can only be traded during an active game.',
    );
  }

  const body = await readJson<{
    firstParticipantId?: unknown;
    secondParticipantId?: unknown;
    idempotencyKey?: unknown;
  }>(request);
  if (
    typeof body.firstParticipantId !== 'string' ||
    !uuidPattern.test(body.firstParticipantId) ||
    typeof body.secondParticipantId !== 'string' ||
    !uuidPattern.test(body.secondParticipantId) ||
    body.firstParticipantId === body.secondParticipantId
  ) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose two different players for this trade.');
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
    throw new HttpError(429, 'RATE_LIMITED', 'Too many public game-night updates. Try again later.');
  }

  const { error } = await client.rpc('trade_team_challenges', {
    p_game_night_id: night.id,
    p_first_participant_id: body.firstParticipantId,
    p_second_participant_id: body.secondParticipantId,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) {
    if (error.message.includes('ACTIVE_NIGHT_NOT_FOUND')) {
      throw new HttpError(409, 'NIGHT_COMPLETED', 'This game night is no longer active.');
    }
    if (error.message.includes('PARTICIPANT_NOT_FOUND')) {
      throw new HttpError(404, 'NOT_FOUND', 'A player was not found in this game night.');
    }
    if (error.message.includes('CHALLENGE_NOT_AVAILABLE')) {
      throw new HttpError(
        409,
        'CHALLENGE_NOT_AVAILABLE',
        'Both teammates need an unfinished challenge to trade.',
      );
    }
    if (error.message.includes('PLAYERS_NOT_TEAMMATES')) {
      throw new HttpError(
        409,
        'PLAYERS_NOT_TEAMMATES',
        'Challenges can only be traded between players on the same team.',
      );
    }
    if (error.message.includes('CHALLENGE_TIMER_RUNNING')) {
      throw new HttpError(
        409,
        'CHALLENGE_TIMER_RUNNING',
        'Stop or pause both challenge timers before trading.',
      );
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

  return jsonResponse({ traded: true });
}
