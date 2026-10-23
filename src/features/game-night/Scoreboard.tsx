import type { Participant, Team } from './types';
import { rankParticipants } from './leaderboard-rank';
import { EmptyState } from '../../components/Feedback';

interface ScoreboardProps {
  participants: Participant[];
  teams: Team[];
  hostCapability: string | null;
  canSubmitScores: boolean;
  onScore: (participantId: string, delta: number) => Promise<void>;
}

export function Scoreboard({
  participants,
  teams,
  hostCapability,
  canSubmitScores,
  onScore,
}: ScoreboardProps) {
  const ranked = rankParticipants(participants);
  let teamRank = 0;
  let previousTeamScore: number | null = null;
  const rankedTeams = [...teams]
    .sort((left, right) => right.score - left.score)
    .map((team, index) => {
      if (team.score !== previousTeamScore) teamRank = index + 1;
      previousTeamScore = team.score;
      return { ...team, rank: teamRank };
    });
  return (
    <section className="panel scoreboard" aria-labelledby="scoreboard-heading">
      <div className="host-toolbar">
        <div>
          <div className="eyebrow">The leaderboard</div>
          <h2 id="scoreboard-heading">Current standings</h2>
        </div>
        <span className="muted">
          {participants.length} player{participants.length === 1 ? '' : 's'}
        </span>
      </div>
      {ranked.length === 0 ? (
        <EmptyState title="No players yet" message="Add players to see the scoreboard." />
      ) : (
        <ol
          className="score-list"
          aria-label="Current standings"
          aria-live="polite"
          aria-atomic="false"
        >
          {ranked.map((participant) => (
            <li className="score-row" key={participant.id}>
              <span className="rank" aria-label={`Rank ${participant.rank}`}>
                {participant.rank}
              </span>
              <span className="score-name">
                {participant.displayName}
                {participant.teamId && (
                  <span className="muted">
                    {teams.find(({ id }) => id === participant.teamId)?.name}
                  </span>
                )}
              </span>
              <span className="score-value" aria-label={`${participant.score} points`}>
                {participant.score}
              </span>
              {canSubmitScores && (
                <span
                  className="score-controls"
                  aria-label={
                    hostCapability
                      ? `Adjust ${participant.displayName} score`
                      : `Submit a score for ${participant.displayName}`
                  }
                >
                  <button
                    aria-label={`Subtract 100 points from ${participant.displayName}`}
                    onClick={() => void onScore(participant.id, -100)}
                  >
                    −
                  </button>
                  <button
                    aria-label={`Add 100 points to ${participant.displayName}`}
                    onClick={() => void onScore(participant.id, 100)}
                  >
                    +
                  </button>
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {canSubmitScores && (
        <p className="muted score-disclosure">
          Anyone with this spectator code can submit score changes under any player&apos;s name.
          Player identity is not verified.
        </p>
      )}
      {rankedTeams.length > 0 && (
        <section aria-labelledby="team-standings-heading">
          <h3 id="team-standings-heading">Team standings</h3>
          <ol className="score-list" aria-label="Team standings" aria-live="polite">
            {rankedTeams.map((team) => {
              const members = participants
                .filter((participant) => participant.teamId === team.id)
                .map((participant) => participant.displayName);
              return (
                <li className="score-row" key={team.id}>
                  <span className="rank" aria-label={`Rank ${team.rank}`}>
                    {team.rank}
                  </span>
                  <div className="score-name">
                    <span>{team.name}</span>
                    <span className="team-members">
                      {members.length > 0
                        ? `Players: ${members.join(', ')}`
                        : 'No players assigned'}
                    </span>
                  </div>
                  <span className="score-value" aria-label={`${team.score} points`}>
                    {team.score}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </section>
  );
}
