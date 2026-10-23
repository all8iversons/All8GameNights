import { useState } from 'react';
import { gameNightApi } from './game-night-api';
import type { Participant } from './types';

interface HostControlsProps {
  spectatorCode: string;
  hostCapability: string;
  status: 'setup' | 'active';
  participants: Participant[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

export function HostControls({
  spectatorCode,
  hostCapability,
  status,
  participants,
  onChanged,
  onError,
}: HostControlsProps) {
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);

  async function addParticipant(event: React.FormEvent) {
    event.preventDefault();
    if (!displayName.trim()) return;
    setBusy(true);
    try {
      await gameNightApi.addParticipant(spectatorCode, hostCapability, displayName);
      setDisplayName('');
      await onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not add participant.');
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    setBusy(true);
    try {
      await gameNightApi.start(spectatorCode, hostCapability);
      await onChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not start game night.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="panel stack host-controls-panel"
      aria-labelledby="setup-players-heading"
    >
      <div>
        <div className="eyebrow">{status === 'setup' ? 'Before the first round' : 'Host controls'}</div>
        <h2 id="setup-players-heading">{status === 'setup' ? 'Add your players' : 'Update the roster'}</h2>
      </div>
      <form className="form-row" onSubmit={addParticipant}>
        <label className="sr-only" htmlFor="player-name">
          Player name
        </label>
        <input
          className="field"
          id="player-name"
          maxLength={40}
          value={displayName}
          disabled={busy}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="Enter a name"
        />
        <button className="button" type="submit" disabled={busy || !displayName.trim()}>
          Add player
        </button>
      </form>
      <p className="muted">
        {participants.length} player{participants.length === 1 ? '' : 's'} in this game night.
        {status === 'setup' ? ' At least one is needed to begin.' : ''}
      </p>
      {status === 'setup' && (
        <button
          className="button secondary"
          onClick={startGame}
          disabled={busy || participants.length === 0}
        >
          Start game night
        </button>
      )}
    </section>
  );
}
