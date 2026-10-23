import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { mapRound, requireHost } from './shared.ts';

const actions = new Set(['start', 'pause', 'resume', 'reset', 'finish']);

export async function controlTimer(request: Request, spectatorCode: string, roundId: string) {
  const { client, night, authorized } = await requireHost(request, spectatorCode);
  if (authorized.status !== 'active') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'Timers can only be changed during an active game.',
    );
  }

  const body = await readJson<{ action?: unknown; durationSeconds?: unknown }>(request);
  if (typeof body.action !== 'string' || !actions.has(body.action)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Choose a supported timer action.');
  }
  if (
    body.action === 'start' &&
    (!Number.isInteger(body.durationSeconds) || Number(body.durationSeconds) <= 0)
  ) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'A positive whole-second timer duration is required.',
    );
  }

  const { data: round, error } = await client.rpc('apply_timer_action', {
    p_round_id: roundId,
    p_game_night_id: night.id,
    p_action: body.action,
    p_duration_seconds: body.action === 'start' ? body.durationSeconds : null,
  });
  if (error) {
    if (error.message.includes('ROUND_NOT_FOUND')) {
      throw new HttpError(404, 'NOT_FOUND', 'Challenge round was not found.');
    }
    if (error.message.includes('INVALID_TIMER') || error.message.includes('ROUND_ALREADY_FINISHED')) {
      throw new HttpError(
        409,
        'INVALID_STATE_TRANSITION',
        'That timer action is not available in its current state.',
      );
    }
    throw error;
  }
  const { data: withChallenge, error: fetchError } = await client
    .from('challenge_rounds')
    .select('*, challenges(id, name, instructions)')
    .eq('id', round.id)
    .single();
  if (fetchError) throw fetchError;
  return jsonResponse({ challengeRound: mapRound(withChallenge) });
}

export async function undoFinishChallenge(
  request: Request,
  spectatorCode: string,
  roundId: string,
) {
  const { client, night, authorized } = await requireHost(request, spectatorCode);
  if (authorized.status !== 'active') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'A challenge finish can only be undone during an active game.',
    );
  }
  const { data: round, error } = await client.rpc('undo_finish_game_night_challenge', {
    p_game_night_id: night.id,
    p_round_id: roundId,
  });
  if (error?.message.includes('ROUND_NOT_FOUND')) {
    throw new HttpError(404, 'NOT_FOUND', 'Challenge round was not found.');
  }
  if (error?.message.includes('PARTICIPANT_NOT_FOUND')) {
    throw new HttpError(404, 'NOT_FOUND', 'Player was not found.');
  }
  if (
    error?.message.includes('ROUND_NOT_FINISHED') ||
    error?.message.includes('UNDO_NOT_AVAILABLE')
  ) {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'Only the player’s most recently finished challenge can be reopened, and only when they have no unfinished challenge.',
    );
  }
  if (error?.message.includes('ACTIVE_NIGHT_NOT_FOUND')) {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'A challenge finish can only be undone during an active game.',
    );
  }
  if (error) throw error;
  const { data: withChallenge, error: fetchError } = await client
    .from('challenge_rounds')
    .select('*, challenges(id, name, instructions)')
    .eq('id', round.id)
    .single();
  if (fetchError) throw fetchError;
  return jsonResponse({ challengeRound: mapRound(withChallenge) });
}
