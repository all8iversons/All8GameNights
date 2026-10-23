import { HttpError, jsonResponse } from '../_shared/http.ts';
import { getSnapshot, requireHost } from './shared.ts';

export async function completeGameNight(request: Request, spectatorCode: string) {
  const { client, night } = await requireHost(request, spectatorCode, true);
  const { data: completed, error } = await client.rpc('complete_game_night', {
    p_game_night_id: night.id,
  });
  if (error) {
    if (error.message.includes('EMPTY_ROSTER')) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        'Add at least one participant before ending the game.',
      );
    }
    throw error;
  }
  return jsonResponse(await getSnapshot(client, completed));
}
