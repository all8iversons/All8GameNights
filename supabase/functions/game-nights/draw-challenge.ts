import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { requireHost, mapRound } from './shared.ts';

export async function drawChallenge(request: Request, spectatorCode: string) {
  const { client, night, authorized } = await requireHost(request, spectatorCode);
  if (authorized.status !== 'active') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'Challenges can only be drawn during an active game.',
    );
  }
  const body = await readJson<{ participantId?: unknown; idempotencyKey?: unknown }>(request);
  if (typeof body.participantId !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a player for this challenge.');
  }
  if (
    typeof body.idempotencyKey !== 'string' ||
    !body.idempotencyKey ||
    body.idempotencyKey.length > 128
  ) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'An idempotency key is required.');
  }

  const { data: roundId, error } = await client.rpc('draw_unused_challenge', {
    p_game_night_id: night.id,
    p_participant_id: body.participantId,
    p_idempotency_key: body.idempotencyKey,
  });
  if (error) {
    if (error.message.includes('ACTIVE_NIGHT_NOT_FOUND')) {
      throw new HttpError(409, 'NIGHT_COMPLETED', 'This game night is no longer active.');
    }
    if (error.message.includes('IDEMPOTENCY_KEY_REUSED')) {
      throw new HttpError(
        409,
        'IDEMPOTENCY_KEY_REUSED',
        'This request key was used for another operation.',
      );
    }
    if (error.message.includes('PARTICIPANT_NOT_FOUND')) {
      throw new HttpError(404, 'NOT_FOUND', 'Participant was not found.');
    }
    if (error.message.includes('PLAYER_HAS_UNFINISHED_ROUND')) {
      throw new HttpError(
        409,
        'ROUND_ALREADY_ACTIVE',
        'Finish this player’s current challenge before drawing another.',
      );
    }
    throw error;
  }
  if (!roundId) {
    throw new HttpError(
      409,
      'NO_UNUSED_CHALLENGES',
      'All available challenges have already been drawn tonight.',
    );
  }

  const { data: round, error: roundError } = await client
    .from('challenge_rounds')
    .select('*, challenges(id, name, instructions)')
    .eq('id', roundId)
    .single();
  if (roundError) throw roundError;
  return jsonResponse({ challengeRound: mapRound(round) }, 201);
}
