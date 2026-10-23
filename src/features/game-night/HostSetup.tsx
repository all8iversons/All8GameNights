import { useState } from 'react';
import { apiRequest } from '../../lib/api-client';
import type { CreatedGameNightResponse } from '../../lib/api-types';

interface HostSetupProps {
  onCreated: (spectatorCode: string, hostCapability: string) => void;
  onJoin: (spectatorCode: string) => void;
}

export function HostSetup({ onCreated, onJoin }: HostSetupProps) {
  const [spectatorCode, setSpectatorCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const normalizedJoinCode = spectatorCode.trim();
  const validJoinCode =
    /^\d{6}$/.test(normalizedJoinCode) || /^[a-f0-9]{64}$/i.test(normalizedJoinCode);

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
            <p className="muted">Enter the read-only code from your host to follow along.</p>
          </div>
          <form
            className="form-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (validJoinCode) onJoin(normalizedJoinCode);
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
            <button className="button secondary" type="submit" disabled={!validJoinCode}>
              Join
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
