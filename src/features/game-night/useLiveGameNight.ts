import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseConfig } from '../../lib/config';
import { gameNightApi } from './game-night-api';
import type { GameNight } from './types';

export function useLiveGameNight(spectatorCode: string) {
  const [gameNight, setGameNight] = useState<GameNight | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const realtimeConnectedRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const result = await gameNightApi.snapshot(spectatorCode);
      setGameNight(result.gameNight);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load the game night.');
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [spectatorCode]);

  useEffect(() => {
    let active = true;
    let refreshTimeout: ReturnType<typeof setTimeout> | undefined;
    let supabase: ReturnType<typeof createClient>;
    try {
      const config = getSupabaseConfig();
      supabase = createClient(config.url, config.publishableKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Realtime configuration is unavailable.');
      setLoading(false);
      return;
    }

    const safeRefresh = () => {
      if (refreshTimeout) return;
      refreshTimeout = setTimeout(() => {
        refreshTimeout = undefined;
        void gameNightApi
          .snapshot(spectatorCode)
          .then((result) => {
            if (active) {
              setGameNight(result.gameNight);
              setError('');
              setLoading(false);
            }
          })
          .catch((cause: unknown) => {
            if (active) {
              setError(cause instanceof Error ? cause.message : 'Could not refresh game state.');
              setLoading(false);
            }
          });
      }, 120);
    };

    void gameNightApi
      .snapshot(spectatorCode)
      .then((result) => {
        if (active) {
          setGameNight(result.gameNight);
          setError('');
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not load the game night.');
          setLoading(false);
        }
      });

    let channel: RealtimeChannel | undefined;
    void hashCapability(spectatorCode)
      .then((hashedCode) => {
        if (!active) return;
        channel = supabase
          .channel(`game-night:${hashedCode}`, { config: { private: false } })
          .on('broadcast', { event: 'state_changed' }, safeRefresh)
          .subscribe((status) => {
            realtimeConnectedRef.current = status === 'SUBSCRIBED';
            setRealtimeConnected(status === 'SUBSCRIBED');
            if (status === 'SUBSCRIBED') safeRefresh();
          });
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not connect to live updates.');
        }
      });

    const poll = window.setInterval(() => {
      if (!realtimeConnectedRef.current) safeRefresh();
    }, 15000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') safeRefresh();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      active = false;
      if (refreshTimeout) clearTimeout(refreshTimeout);
      window.clearInterval(poll);
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [spectatorCode]);

  return { gameNight, error, loading, refresh, setError, realtimeConnected };
}

async function hashCapability(capability: string): Promise<string> {
  const bytes = new TextEncoder().encode(capability);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join(
    '',
  );
}
