import { useEffect, useState } from 'react';
import { gameNightApi } from '../game-night/game-night-api';
import type { LeaderboardEntry } from '../game-night/types';
import { EmptyState, ErrorState, LoadingState } from '../../components/Feedback';
import { sortLeaderboardEntries } from './leaderboard-utils';

export function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    gameNightApi
      .leaderboard()
      .then(({ entries: results }) => {
        if (active) setEntries(results);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : 'Could not load past winners.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="page-heading">
        <div className="eyebrow">The bragging-rights archive</div>
        <h1>Hall of Fame</h1>
        <p>Every champion, every comeback, every unforgettable game night.</p>
      </section>
      <section className="history-list" aria-label="Previous game-night results">
        {loading && <LoadingState message="Loading past winners…" />}
        {error && <ErrorState message={error} title="Past winners unavailable" />}
        {!loading && !error && entries.length === 0 && (
          <EmptyState
            title="No champions yet"
            message="Finish your first game night and its winners will be remembered here."
          />
        )}
        {sortLeaderboardEntries(entries).map((entry) => (
          <article className="panel history-card" key={entry.gameNightId}>
            <div>
              <div className="eyebrow">{new Date(entry.date).toLocaleDateString()}</div>
              <h2 className="history-winner">
                🏆 {entry.winners.map((winner) => winner.displayName).join(' & ')}
              </h2>
            </div>
            <div>
              <strong>{entry.winners.map((winner) => winner.score).join(' / ')} points</strong>
              <p className="muted">
                {entry.participants
                  .map((participant) => `${participant.displayName}: ${participant.score}`)
                  .join(' · ')}
              </p>
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
