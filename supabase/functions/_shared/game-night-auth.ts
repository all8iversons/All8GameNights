import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { constantTimeEqual, hashCapability } from './capabilities.ts';
import { HttpError } from './http.ts';

export function serviceClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) {
    throw new Error('Server-side Supabase credentials are not configured.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export function readCapability(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Host authorization is required.');
  }
  return authorization.slice(7);
}

export async function authorizeHost(
  request: Request,
  gameNightId: string,
  client = serviceClient(),
  allowCompleted = false,
) {
  const capability = readCapability(request);
  const candidateHash = await hashCapability(capability);
  const { data, error } = await client
    .from('game_nights')
    .select('id, status, host_token_hash')
    .eq('id', gameNightId)
    .maybeSingle();

  if (error) throw error;
  if (!data || !constantTimeEqual(candidateHash, data.host_token_hash)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Host authorization is invalid.');
  }
  if (data.status === 'completed' && !allowCompleted) {
    throw new HttpError(409, 'NIGHT_COMPLETED', 'This game night has already ended.');
  }
  return data as { id: string; status: 'setup' | 'active' | 'completed'; host_token_hash: string };
}
