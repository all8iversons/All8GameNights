import { HttpError, jsonResponse, readJson } from '../_shared/http.ts';
import { requireHost, mapParticipant } from './shared.ts';

export async function addParticipant(request: Request, spectatorCode: string) {
  const { client, night, authorized } = await requireHost(request, spectatorCode);
  if (authorized.status !== 'setup' && authorized.status !== 'active') {
    throw new HttpError(
      409,
      'INVALID_STATE_TRANSITION',
      'Participants cannot be added after the game night has ended.',
    );
  }
  const body = await readJson<{ displayName?: unknown }>(request);
  if (typeof body.displayName !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'A participant name is required.');
  }
  const displayName = body.displayName.trim();
  if (displayName.length < 1 || displayName.length > 40) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Participant names must contain 1 to 40 characters.',
    );
  }
  const { data: participant, error } = await client
    .from('participants')
    .insert({ game_night_id: night.id, display_name: displayName })
    .select('*')
    .single();
  if (error?.code === '23505') {
    throw new HttpError(
      409,
      'DUPLICATE_PARTICIPANT',
      'A participant with that name already exists.',
    );
  }
  if (error) throw error;
  return jsonResponse({ participant: mapParticipant(participant) }, 201);
}
