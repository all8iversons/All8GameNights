function required(name: string, value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
};

export function getSupabaseConfig() {
  const runtimeConfig = typeof window === 'undefined' ? undefined : window.__APP_CONFIG__;
  const url = required(
    'VITE_SUPABASE_URL',
    runtimeConfig === undefined ? config.supabaseUrl : runtimeConfig.supabaseUrl,
  );
  const publishableKey = required(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    runtimeConfig === undefined ? config.supabasePublishableKey : runtimeConfig.supabasePublishableKey,
  );

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      'VITE_SUPABASE_URL must be an absolute HTTP or HTTPS URL without credentials.',
    );
  }

  if (
    !['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username !== '' ||
    parsedUrl.password !== ''
  ) {
    throw new Error('VITE_SUPABASE_URL must be an absolute HTTP or HTTPS URL without credentials.');
  }

  return {
    url: url.replace(/\/+$/, ''),
    publishableKey,
  };
}
