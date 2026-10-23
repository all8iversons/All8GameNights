import { useState } from 'react';
import type { Challenge } from '../game-night/types';
import { gameNightApi } from '../game-night/game-night-api';

type TeamName = { id: string; name: string; createdAt: string };

export function GlobalContentAdminPage() {
  const [password, setPassword] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [teamNames, setTeamNames] = useState<TeamName[]>([]);
  const [challengeName, setChallengeName] = useState('');
  const [challengeInstructions, setChallengeInstructions] = useState('');
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function unlock(event: React.FormEvent) {
    event.preventDefault();
    setBusy('unlock');
    setError('');
    setMessage('');
    try {
      const [catalog, pool] = await Promise.all([
        gameNightApi.adminChallengeCatalog(password),
        gameNightApi.adminTeamNames(password),
      ]);
      setChallenges(catalog.challenges);
      setTeamNames(pool.teamNames);
      setAuthorized(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open global management.');
    } finally {
      setBusy('');
    }
  }

  async function addChallenge(event: React.FormEvent) {
    event.preventDefault();
    setBusy('new-challenge');
    setError('');
    try {
      const { challenge } = await gameNightApi.adminCreateChallenge(password, {
        name: challengeName,
        instructions: challengeInstructions,
      });
      setChallenges((current) =>
        [...current, challenge].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setChallengeName('');
      setChallengeInstructions('');
      setMessage('Challenge added to the shared catalog.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add challenge.');
    } finally {
      setBusy('');
    }
  }

  async function saveChallenge(challenge: Challenge) {
    setBusy(challenge.id);
    setError('');
    try {
      const { challenge: updated } = await gameNightApi.adminUpdateChallenge(
        password,
        challenge.id,
        challenge,
      );
      setChallenges((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Challenge saved. Changes apply to existing assignments.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save challenge.');
    } finally {
      setBusy('');
    }
  }

  async function archiveChallenge(challenge: Challenge) {
    setBusy(challenge.id);
    setError('');
    try {
      const { challenge: updated } = await gameNightApi.adminArchiveChallenge(
        password,
        challenge.id,
      );
      setChallenges((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setMessage('Challenge archived. Existing game history is preserved.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not archive challenge.');
    } finally {
      setBusy('');
    }
  }

  async function addTeamName(event: React.FormEvent) {
    event.preventDefault();
    setBusy('new-team-name');
    setError('');
    try {
      const { teamName } = await gameNightApi.adminCreateTeamName(password, teamNameDraft);
      setTeamNames((current) =>
        [...current, teamName].sort((left, right) => left.name.localeCompare(right.name)),
      );
      setTeamNameDraft('');
      setMessage('Random team name added to the pool.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not add random team name.');
    } finally {
      setBusy('');
    }
  }

  async function saveTeamName(teamName: TeamName) {
    setBusy(teamName.id);
    setError('');
    try {
      const { teamName: updated } = await gameNightApi.adminUpdateTeamName(
        password,
        teamName.id,
        teamName.name,
      );
      setTeamNames((current) =>
        current
          .map((item) => (item.id === updated.id ? updated : item))
          .sort((left, right) => left.name.localeCompare(right.name)),
      );
      setMessage('Random team name updated.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update random team name.');
    } finally {
      setBusy('');
    }
  }

  async function removeTeamName(teamName: TeamName) {
    if (!window.confirm(`Remove "${teamName.name}" from future random team generation?`)) return;
    setBusy(teamName.id);
    setError('');
    try {
      await gameNightApi.adminRemoveTeamName(password, teamName.id);
      setTeamNames((current) => current.filter((item) => item.id !== teamName.id));
      setMessage('Random team name removed. Existing teams are unchanged.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove random team name.');
    } finally {
      setBusy('');
    }
  }

  function updateChallengeDraft(id: string, patch: Partial<Challenge>) {
    setChallenges((current) =>
      current.map((challenge) => (challenge.id === id ? { ...challenge, ...patch } : challenge)),
    );
  }

  function lock() {
    setAuthorized(false);
    setPassword('');
    setChallenges([]);
    setTeamNames([]);
    setError('');
    setMessage('');
  }

  return (
    <section className="global-admin-page">
      <div className="page-heading">
        <div className="eyebrow">Shared game content</div>
        <h1>Manage game content.</h1>
        <p>Maintain challenges and random team names without opening a game night.</p>
      </div>

      {!authorized ? (
        <form className="panel stack global-admin-login" onSubmit={(event) => void unlock(event)}>
          <label htmlFor="global-admin-password">Admin password</label>
          <input
            id="global-admin-password"
            className="field"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <p className="muted">
            The password is checked by the server and is kept only in this page's memory.
          </p>
          <button className="button" type="submit" disabled={busy !== '' || !password}>
            {busy === 'unlock' ? 'Verifying…' : 'Unlock content management'}
          </button>
        </form>
      ) : (
        <>
          <div className="global-admin-toolbar">
            <p className="muted">Changes apply globally to future and current game nights.</p>
            <button className="button secondary small" type="button" onClick={lock}>
              Lock management
            </button>
          </div>

          <div className="global-admin-grid">
            <section className="panel stack" aria-labelledby="admin-challenges-heading">
              <div>
                <div className="eyebrow">Shared across all games</div>
                <h2 id="admin-challenges-heading">Challenge catalog</h2>
                <p className="muted">
                  Archive a challenge to prevent future draws while preserving all assigned rounds
                  and history.
                </p>
              </div>
              <form className="stack" onSubmit={(event) => void addChallenge(event)}>
                <label htmlFor="admin-new-challenge-name">Challenge name</label>
                <input
                  id="admin-new-challenge-name"
                  className="field"
                  maxLength={100}
                  value={challengeName}
                  onChange={(event) => setChallengeName(event.target.value)}
                  required
                />
                <label htmlFor="admin-new-challenge-instructions">Instructions</label>
                <textarea
                  id="admin-new-challenge-instructions"
                  className="field challenge-instructions-field"
                  maxLength={1000}
                  value={challengeInstructions}
                  onChange={(event) => setChallengeInstructions(event.target.value)}
                  required
                />
                <button
                  className="button"
                  type="submit"
                  disabled={
                    busy !== '' || !challengeName.trim() || !challengeInstructions.trim()
                  }
                >
                  Add challenge
                </button>
              </form>
              <ul className="global-content-list">
                {challenges.map((challenge) => (
                  <li className="global-content-item" key={challenge.id}>
                    <form
                      className="stack"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void saveChallenge(challenge);
                      }}
                    >
                      <label htmlFor={`admin-challenge-name-${challenge.id}`}>Name</label>
                      <input
                        id={`admin-challenge-name-${challenge.id}`}
                        className="field"
                        maxLength={100}
                        value={challenge.name}
                        disabled={busy !== ''}
                        onChange={(event) =>
                          updateChallengeDraft(challenge.id, { name: event.target.value })
                        }
                        required
                      />
                      <label htmlFor={`admin-challenge-instructions-${challenge.id}`}>
                        Instructions
                      </label>
                      <textarea
                        id={`admin-challenge-instructions-${challenge.id}`}
                        className="field challenge-instructions-field"
                        maxLength={1000}
                        value={challenge.instructions}
                        disabled={busy !== ''}
                        onChange={(event) =>
                          updateChallengeDraft(challenge.id, {
                            instructions: event.target.value,
                          })
                        }
                        required
                      />
                      <label className="challenge-enabled">
                        <input
                          type="checkbox"
                          checked={challenge.enabled}
                          disabled={busy !== ''}
                          onChange={(event) =>
                            updateChallengeDraft(challenge.id, {
                              enabled: event.target.checked,
                            })
                          }
                        />
                        Available for future draws
                      </label>
                      <div className="global-content-actions">
                        <button
                          className="button secondary small"
                          type="submit"
                          disabled={busy !== '' || !challenge.name.trim() || !challenge.instructions.trim()}
                        >
                          {busy === challenge.id ? 'Saving…' : 'Save challenge'}
                        </button>
                        {challenge.enabled && (
                          <button
                            className="button secondary small"
                            type="button"
                            disabled={busy !== ''}
                            onClick={() => void archiveChallenge(challenge)}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    </form>
                  </li>
                ))}
              </ul>
            </section>

            <section className="panel stack" aria-labelledby="admin-team-names-heading">
              <div>
                <div className="eyebrow">Used for generated teams</div>
                <h2 id="admin-team-names-heading">Random team-name pool</h2>
                <p className="muted">
                  Edit or remove names from future random team generation. Existing game-night
                  teams keep their names.
                </p>
              </div>
              <form className="form-row" onSubmit={(event) => void addTeamName(event)}>
                <label className="sr-only" htmlFor="admin-new-team-name">
                  New random team name
                </label>
                <input
                  id="admin-new-team-name"
                  className="field"
                  maxLength={40}
                  value={teamNameDraft}
                  onChange={(event) => setTeamNameDraft(event.target.value)}
                  required
                />
                <button
                  className="button"
                  type="submit"
                  disabled={busy !== '' || !teamNameDraft.trim()}
                >
                  Add name
                </button>
              </form>
              <ul className="global-content-list" aria-label="Random team names">
                {teamNames.map((teamName) => (
                  <li className="global-team-name-item" key={teamName.id}>
                    <label className="sr-only" htmlFor={`pool-team-name-${teamName.id}`}>
                      Edit random team name
                    </label>
                    <input
                      id={`pool-team-name-${teamName.id}`}
                      className="field"
                      maxLength={40}
                      value={teamName.name}
                      disabled={busy !== ''}
                      onChange={(event) =>
                        setTeamNames((current) =>
                          current.map((item) =>
                            item.id === teamName.id ? { ...item, name: event.target.value } : item,
                          ),
                        )
                      }
                    />
                    <button
                      className="button secondary small"
                      type="button"
                      disabled={busy !== '' || !teamName.name.trim()}
                      onClick={() => void saveTeamName(teamName)}
                    >
                      {busy === teamName.id ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      className="button secondary small"
                      type="button"
                      disabled={busy !== ''}
                      onClick={() => void removeTeamName(teamName)}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              {teamNames.length === 0 && (
                <p className="muted" role="status">
                  The pool is empty. Add at least one name to enable random team generation.
                </p>
              )}
            </section>
          </div>
        </>
      )}

      {error && (
        <p className="alert" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="success" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
