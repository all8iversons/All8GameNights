import { afterEach, describe, expect, it } from 'vitest';
import { getSupabaseConfig } from '../../../src/lib/config';

afterEach(() => {
  delete window.__APP_CONFIG__;
});

describe('getSupabaseConfig', () => {
  it('uses browser-safe runtime configuration', () => {
    const runtimeConfig = {
      supabaseUrl: 'http://192.168.1.20:8000',
      supabasePublishableKey: 'public-key',
      serviceRoleKey: 'must-not-be-exposed',
    };
    window.__APP_CONFIG__ = runtimeConfig;

    expect(getSupabaseConfig()).toEqual({
      url: 'http://192.168.1.20:8000',
      publishableKey: 'public-key',
    });
  });

  it('rejects missing runtime values instead of silently falling back', () => {
    window.__APP_CONFIG__ = {};

    expect(() => getSupabaseConfig()).toThrow(
      'Missing required environment variable: VITE_SUPABASE_URL',
    );
  });

  it('rejects malformed or unsafe Supabase URLs', () => {
    window.__APP_CONFIG__ = {
      supabaseUrl: 'javascript:alert(1)',
      supabasePublishableKey: 'public-key',
    };

    expect(() => getSupabaseConfig()).toThrow(
      'VITE_SUPABASE_URL must be an absolute HTTP or HTTPS URL without credentials.',
    );
  });
});
