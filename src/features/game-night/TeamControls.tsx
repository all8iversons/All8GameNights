import { useState } from 'react';
import { gameNightApi } from './game-night-api';
import type { Participant, Team } from './types';

interface TeamControlsProps {
  spectatorCode: string;
  hostCapability: string;
  participants: Participant[];
  teams: Team[];
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}

export function TeamControls({
  spectatorCode,
  hostCapability,
  participants,
  teams,
  onChanged,
  onError,
}: TeamControlsProps) {
  const [teamName, setTeamName] = useState('');
  const [renamedTeams, setRenamedTeams] = useState<Record<string, string>>({});
  const [teamSetupMode, setTeamSetupMode] = useState<'team_count' | 'players_per_team'>(
    'team_count',
  );
  const [teamSetupCount, setTeamSetupCount] = useState(
    String(Math.min(2, Math.max(1, participants.length))),
  );
  const [busy, setBusy] = useState(false);
  const parsedTeamSetupCount = Number(teamSetupCount);
  const validTeamSetupCount =
    Number.isInteger(parsedTeamSetupCount) &&
    parsedTeamSetupCount >= 1 &&
    parsedTeamSetupCount <= participants.length;

  async function runChange(change: () => Promise<unknown>) {
    setBusy(true);
    try {
      await change();
      await onChanged();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : 'Could not update teams.');
    } finally {
      setBusy(false);
    }
  }

  async function createTeam(event: React.FormEvent) {
    event.preventDefault();
    if (!teamName.trim()) return;
    await runChange(async () => {
      await gameNightApi.createTeam(spectatorCode, hostCapability, teamName);
      setTeamName('');
    });
  }

  async function generateTeams(event: React.FormEvent) {
    event.preventDefault();
    if (!validTeamSetupCount) return;
    await runChange(() =>
      gameNightApi.generateTeams(
        spectatorCode,
        hostCapability,
        teamSetupMode,
        parsedTeamSetupCount,
      ),
    );
  }

  return (
    <section
      className="panel stack team-controls-panel"
      aria-labelledby="team-controls-heading"
    >
      <div>
        <div className="eyebrow">Team play</div>
        <h2 id="team-controls-heading">Manage teams</h2>
      </div>
      <form className="form-row" onSubmit={createTeam}>
        <label className="sr-only" htmlFor="team-name">
          Team name
        </label>
        <input
          className="field"
          id="team-name"
          maxLength={40}
          value={teamName}
          disabled={busy}
          onChange={(event) => setTeamName(event.target.value)}
          placeholder="Create a team"
        />
        <button className="button" type="submit" disabled={busy || !teamName.trim()}>
          Add team
        </button>
      </form>
      {participants.length > 0 && (
        <form className="stack" onSubmit={generateTeams}>
          <h3>Generate space-themed teams</h3>
          <div className="form-row">
            <label className="sr-only" htmlFor="team-setup-mode">
              Team setup method
            </label>
            <select
              id="team-setup-mode"
              className="field"
              value={teamSetupMode}
              disabled={busy}
              onChange={(event) =>
                setTeamSetupMode(
                  event.target.value === 'players_per_team' ? 'players_per_team' : 'team_count',
                )
              }
            >
              <option value="team_count">Number of teams</option>
              <option value="players_per_team">Players per team</option>
            </select>
            <label className="sr-only" htmlFor="team-setup-count">
              {teamSetupMode === 'team_count' ? 'Number of teams' : 'Players per team'}
            </label>
            <input
              id="team-setup-count"
              className="field"
              type="number"
              min={1}
              max={participants.length}
              step={1}
              value={teamSetupCount}
              disabled={busy}
              onChange={(event) => setTeamSetupCount(event.target.value)}
            />
            <button className="button" type="submit" disabled={busy || !validTeamSetupCount}>
              Generate random teams
            </button>
          </div>
          <p className="muted">
            Team names are randomly generated from an original space theme. Generating teams
            replaces existing teams and assignments; player scores are kept.
          </p>
        </form>
      )}
      {teams.length > 0 && participants.length > 0 && (
        <button
          className="button secondary"
          disabled={busy}
          onClick={() =>
            void runChange(() => gameNightApi.randomizeTeams(spectatorCode, hostCapability))
          }
        >
          Randomize players across teams
        </button>
      )}
      {teams.length > 0 && (
        <ul className="team-control-list">
          {teams.map((team) => (
            <li key={team.id} className="team-control-row">
              <form
                className="form-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void runChange(() =>
                    gameNightApi.renameTeam(
                      spectatorCode,
                      hostCapability,
                      team.id,
                      renamedTeams[team.id] ?? team.name,
                    ),
                  );
                }}
              >
                <label className="sr-only" htmlFor={`team-name-${team.id}`}>
                  Rename {team.name}
                </label>
                <input
                  id={`team-name-${team.id}`}
                  className="field"
                  maxLength={40}
                  value={renamedTeams[team.id] ?? team.name}
                  disabled={busy}
                  onChange={(event) =>
                    setRenamedTeams((current) => ({ ...current, [team.id]: event.target.value }))
                  }
                />
                <button
                  className="button secondary"
                  type="submit"
                  disabled={busy || !(renamedTeams[team.id] ?? team.name).trim()}
                >
                  Rename
                </button>
              </form>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void runChange(() =>
                    gameNightApi.deleteTeam(spectatorCode, hostCapability, team.id),
                  )
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {participants.length > 0 && (
        <div className="stack">
          <h3>Assign players</h3>
          {participants.map((participant) => (
            <div className="form-row" key={participant.id}>
              <label htmlFor={`team-assignment-${participant.id}`} className="score-name">
                {participant.displayName}
              </label>
              <select
                id={`team-assignment-${participant.id}`}
                className="field"
                value={participant.teamId ?? ''}
                disabled={busy}
                onChange={(event) =>
                  void runChange(() =>
                    gameNightApi.assignTeam(
                      spectatorCode,
                      hostCapability,
                      participant.id,
                      event.target.value || null,
                    ),
                  )
                }
              >
                <option value="">Unassigned</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
