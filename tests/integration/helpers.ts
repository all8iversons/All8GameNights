import { integrationEnvironment } from './setup';

const configured = Boolean(integrationEnvironment.url && integrationEnvironment.publishableKey);

export async function invoke<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    hostCapability?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: T }> {
  if (!configured)
    throw new Error(
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for local integration tests.',
    );
  const headers = new Headers({
    apikey: integrationEnvironment.publishableKey!,
    'Content-Type': 'application/json',
    ...options.headers,
  });
  if (options.hostCapability) headers.set('Authorization', `Bearer ${options.hostCapability}`);
  const response = await fetch(`${integrationEnvironment.url}/functions/v1/${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  return { status: response.status, body: (await response.json()) as T };
}

export async function createActiveGame() {
  const created = await invoke<{
    gameNight: { id: string };
    hostCapability: string;
    spectatorCode: string;
  }>('game-nights', {
    method: 'POST',
    body: {},
    headers: { 'x-forwarded-for': `integration-test-${crypto.randomUUID()}` },
  });
  if (created.status !== 201)
    throw new Error(`Could not create integration game: ${created.status}`);
  const { hostCapability, spectatorCode } = created.body;
  for (const displayName of ['Test Player A', 'Test Player B']) {
    const added = await invoke(`game-nights/${spectatorCode}/participants`, {
      method: 'POST',
      hostCapability,
      body: { displayName },
    });
    if (added.status !== 201)
      throw new Error(`Could not add integration participant: ${added.status}`);
  }
  const started = await invoke(`game-nights/${spectatorCode}/start`, {
    method: 'POST',
    hostCapability,
    body: {},
  });
  if (started.status !== 200)
    throw new Error(`Could not start integration game: ${started.status}`);
  return { hostCapability, spectatorCode };
}
