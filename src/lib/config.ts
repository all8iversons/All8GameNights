function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined,
};

export function getSupabaseConfig() {
  return {
    url: required('VITE_SUPABASE_URL', config.supabaseUrl),
    publishableKey: required('VITE_SUPABASE_PUBLISHABLE_KEY', config.supabasePublishableKey),
  };
}
