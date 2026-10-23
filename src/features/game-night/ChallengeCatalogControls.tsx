import { useEffect, useState } from 'react';
import type { Challenge } from './types';
import { gameNightApi } from './game-night-api';

interface ChallengeCatalogControlsProps {
  spectatorCode: string;
  hostCapability: string;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

export function ChallengeCatalogControls({
  spectatorCode,
  hostCapability,
  onChanged,
  onError,
}: ChallengeCatalogControlsProps) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void gameNightApi
      .challengeCatalog(spectatorCode, hostCapability)
      .then(({ challenges: catalog }) => {
        if (active) setChallenges(catalog);
      })
      .catch((cause: unknown) => {
        if (active) {
          onError(cause instanceof Error ? cause.message : 'Could not load challenges.');
        }
      });
    return () => {
      active = false;
    };
  }, [hostCapability, onError, spectatorCode]);

  async function addChallenge(event: React.FormEvent) {
    event.preventDefault();
    setBusy('new');
    setMessage('');
    try {
      const { challenge } = await gameNightApi.createChallenge(
        spectatorCode,
        hostCapability,
        { name, instructions, enabled: true },
      );
      setChallenges((current) =>
        [...current, challenge].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setName('');
      setInstructions('');
      setMessage('Challenge added to the shared catalog.');
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not add challenge.');
    } finally {
      setBusy('');
    }
  }

  async function saveChallenge(challenge: Challenge) {
    setBusy(challenge.id);
    setMessage('');
    try {
      const { challenge: updated } = await gameNightApi.updateChallenge(
        spectatorCode,
        hostCapability,
        challenge.id,
        challenge,
      );
      setChallenges((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setMessage('Challenge updated. Changes apply to any current assignment.');
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not update challenge.');
    } finally {
      setBusy('');
    }
  }

  function updateDraft(challengeId: string, patch: Partial<Challenge>) {
    setChallenges((current) =>
      current.map((challenge) =>
        challenge.id === challengeId ? { ...challenge, ...patch } : challenge,
      ),
    );
  }

  return (
    <details className="panel stack challenge-catalog-controls">
      <summary>Manage shared challenge catalog</summary>
      <p className="muted">
        Add or edit challenges available to every game night. Editing a challenge updates it
        immediately, including existing assignments.
      </p>
      <form className="stack" onSubmit={addChallenge}>
        <label htmlFor="new-challenge-name">Challenge name</label>
        <input
          id="new-challenge-name"
          className="field"
          maxLength={100}
          value={name}
          disabled={busy !== ''}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <label htmlFor="new-challenge-instructions">Instructions</label>
        <textarea
          id="new-challenge-instructions"
          className="field challenge-instructions-field"
          maxLength={1000}
          value={instructions}
          disabled={busy !== ''}
          onChange={(event) => setInstructions(event.target.value)}
          required
        />
        <button
          className="button"
          type="submit"
          disabled={busy !== '' || !name.trim() || !instructions.trim()}
        >
          Add challenge
        </button>
      </form>
      <ul className="challenge-catalog-list">
        {challenges.map((challenge) => (
          <li key={challenge.id}>
            <form
              className="stack"
              onSubmit={(event) => {
                event.preventDefault();
                void saveChallenge(challenge);
              }}
            >
              <label htmlFor={`challenge-name-${challenge.id}`}>Challenge name</label>
              <input
                id={`challenge-name-${challenge.id}`}
                className="field"
                maxLength={100}
                value={challenge.name}
                disabled={busy !== ''}
                onChange={(event) => updateDraft(challenge.id, { name: event.target.value })}
                required
              />
              <label htmlFor={`challenge-instructions-${challenge.id}`}>Instructions</label>
              <textarea
                id={`challenge-instructions-${challenge.id}`}
                className="field challenge-instructions-field"
                maxLength={1000}
                value={challenge.instructions}
                disabled={busy !== ''}
                onChange={(event) =>
                  updateDraft(challenge.id, { instructions: event.target.value })
                }
                required
              />
              <label className="challenge-enabled">
                <input
                  type="checkbox"
                  checked={challenge.enabled}
                  disabled={busy !== ''}
                  onChange={(event) =>
                    updateDraft(challenge.id, { enabled: event.target.checked })
                  }
                />
                Available for future draws
              </label>
              <button
                className="button secondary"
                type="submit"
                disabled={
                  busy !== '' || !challenge.name.trim() || !challenge.instructions.trim()
                }
              >
                {busy === challenge.id ? 'Saving…' : 'Save challenge'}
              </button>
            </form>
          </li>
        ))}
      </ul>
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
