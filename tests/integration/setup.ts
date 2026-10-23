import { readFileSync } from 'node:fs';

function localAdminPassword() {
  if (process.env.GAME_NIGHT_ADMIN_PASSWORD) return process.env.GAME_NIGHT_ADMIN_PASSWORD;
  try {
    const localEnvironment = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8');
    const password = localEnvironment.match(
      /^\s*GAME_NIGHT_ADMIN_PASSWORD\s*=\s*(.*?)\s*$/m,
    )?.[1];
    return password?.replace(/^(['"])(.*)\1$/, '$2') ?? '';
  } catch (cause) {
    if (cause instanceof Error && 'code' in cause && cause.code === 'ENOENT') return '';
    throw cause;
  }
}

export const integrationEnvironment = {
  url: import.meta.env.VITE_SUPABASE_URL,
  publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  adminPassword: localAdminPassword(),
};
