import { useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import { gameNightApi } from './game-night-api';
import type { CreatedGameNightResponse } from '../../lib/api-types';

interface HostSetupProps {
  onCreated: (spectatorCode: string, hostCapability: string) => void;
  onJoin: (spectatorCode: string, displayOnly: boolean) => void;
  onReconnect: (spectatorCode: string, hostCapability: string) => void;
  initialError?: string;
}

export function HostSetup({ onCreated, onJoin, onReconnect, initialError = '' }: HostSetupProps) {
  const [spectatorCode, setSpectatorCode] = useState('');
  const [hostCode, setHostCode] = useState('');
  const [hostRecoveryKey, setHostRecoveryKey] = useState('');
  const [error, setError] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const normalizedJoinCode = spectatorCode.trim();
  const validJoinCode =
    /^\d{6}$/.test(normalizedJoinCode) || /^[a-f0-9]{64}$/i.test(normalizedJoinCode);
  const normalizedHostCode = hostCode.trim();
  const normalizedRecoveryKey = hostRecoveryKey.trim();
  const validHostSession =
    /^\d{6}$/.test(normalizedHostCode) && /^[a-f0-9]{64}$/i.test(normalizedRecoveryKey);

  async function createGameNight() {
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<CreatedGameNightResponse>('game-nights', {
        method: 'POST',
        body: {},
      });
      onCreated(result.spectatorCode, result.hostCapability);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a game night.');
    } finally {
      setBusy(false);
    }
  }

  async function reconnectHost(event: React.FormEvent) {
    event.preventDefault();
    if (!validHostSession) return;
    setBusy(true);
    setError('');
    try {
      await gameNightApi.reconnectHost(normalizedHostCode, normalizedRecoveryKey);
      onReconnect(normalizedHostCode, normalizedRecoveryKey);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not reconnect as host.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">Ready, set, play</div>
        <h1>Make game night legendary.</h1>
        <p>Keep the scores, challenges, and bragging rights all in one place.</p>
      </section>
      <div className="setup-grid">
        <section className="panel stack" aria-labelledby="host-heading">
          <div>
            <div className="eyebrow">Host a game</div>
            <h2 id="host-heading">Start a showdown</h2>
            <p className="muted">Create a game, invite your crew, and take control of the board.</p>
          </div>
          <button className="button" onClick={createGameNight} disabled={busy}>
            {busy ? 'Setting up…' : 'Create game night'}
          </button>
        </section>
        <section className="panel stack" aria-labelledby="join-heading">
          <div>
            <div className="eyebrow">Joining in?</div>
            <h2 id="join-heading">Watch the live board</h2>
            <p className="muted">
              Enter the read-only code from your host to follow along on this screen or a separate
              display.
            </p>
          </div>
          <form
            className="form-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (validJoinCode) onJoin(normalizedJoinCode, false);
            }}
          >
            <label className="sr-only" htmlFor="spectator-code">
              6-digit join code
            </label>
            <input
              id="spectator-code"
              className="field"
              value={spectatorCode}
              inputMode="numeric"
              maxLength={64}
              onChange={(event) => setSpectatorCode(event.target.value.replace(/\s/g, ''))}
              placeholder="Enter 6-digit code"
              autoComplete="off"
            />
            <div className="form-row">
              <button className="button secondary" type="submit" disabled={!validJoinCode}>
                Join
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!validJoinCode}
                onClick={() => onJoin(normalizedJoinCode, true)}
              >
                Join display-only
              </button>
            </div>
          </form>
        </section>
        <section className="panel stack" aria-labelledby="host-reconnect-heading">
          <div>
            <div className="eyebrow">Already hosting?</div>
            <h2 id="host-reconnect-heading">Reconnect as host</h2>
            <p className="muted">
              Enter the room code and your private host recovery key. The spectator code alone
              cannot restore host access.
            </p>
          </div>
          <form className="stack" onSubmit={(event) => void reconnectHost(event)}>
            <label className="sr-only" htmlFor="host-room-code">
              Host room code
            </label>
            <input
              id="host-room-code"
              className="field"
              value={hostCode}
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => setHostCode(event.target.value.replace(/\s/g, ''))}
              placeholder="6-digit room code"
              autoComplete="off"
            />
            <label className="sr-only" htmlFor="host-recovery-key">
              Host recovery key
            </label>
            <input
              id="host-recovery-key"
              className="field"
              type="password"
              value={hostRecoveryKey}
              maxLength={64}
              onChange={(event) => setHostRecoveryKey(event.target.value.trim())}
              placeholder="Private host recovery key"
              autoComplete="off"
              spellCheck={false}
            />
            <button className="button secondary" type="submit" disabled={busy || !validHostSession}>
              {busy ? 'Verifying…' : 'Reconnect as host'}
            </button>
          </form>
        </section>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
