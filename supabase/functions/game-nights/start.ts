import { HttpError, jsonResponse } from '../_shared/http.ts';
import { getSnapshot, requireHost } from './shared.ts';

export async function startGameNight(request: Request, spectatorCode: string) {
  const { client, night, authorized } = await requireHost(request, spectatorCode);
  if (authorized.status !== 'setup') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'This game night has already started or ended.',
    );
  }
  const { count, error: countError } = await client
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('game_night_id', night.id)
    .is('removed_at', null);
  if (countError) throw countError;
  if (!count)
    throw new HttpError(400, 'VALIDATION_ERROR', 'Add at least one participant before starting.');

  const { data: updated, error } = await client
    .from('game_nights')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', night.id)
    .eq('status', 'setup')
    .select('id, status, created_at, started_at, completed_at')
    .maybeSingle();
  if (error) throw error;
  if (!updated)
    throw new HttpError(409, 'INVALID_STATE_TRANSITION', 'This game night has already started.');
  return jsonResponse(await getSnapshot(client, updated));
}
