import { jsonResponse } from '../_shared/http.ts';
import { getSnapshot, resolveNight } from './shared.ts';

export async function readGameNight(request: Request, spectatorCode: string) {
  const { client, night } = await resolveNight(request, spectatorCode);
  return jsonResponse(await getSnapshot(client, night));
}
