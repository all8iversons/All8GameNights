import { useId } from 'react';
import type { ChallengeRound } from '../game-night/types';

interface ChallengePanelProps {
  playerName: string;
  currentRound: ChallengeRound | null;
  canControl: boolean;
  canDraw: boolean;
  exhausted: boolean;
  catalogEmpty: boolean;
  catalogAvailable: boolean;
  busy: boolean;
  onDraw: () => void;
}

export function ChallengePanel({
  playerName,
  currentRound,
  canControl,
  canDraw,
  exhausted,
  catalogEmpty,
  catalogAvailable,
  busy,
  onDraw,
}: ChallengePanelProps) {
  const headingId = useId();
  return (
    <section className="panel challenge-card" aria-labelledby={headingId}>
      <div>
        <div className="eyebrow">Bonus round</div>
        <h2 id={headingId}>{playerName}&apos;s challenge</h2>
      </div>
      {currentRound ? (
        <div>
          <h3>{currentRound.challenge.name}</h3>
          <p className="muted">{currentRound.challenge.instructions}</p>
          {currentRound.finishedAt && <p className="success">Challenge finished</p>}
        </div>
      ) : (
        <p className="muted">A surprise game challenge will appear here.</p>
      )}
      {!catalogAvailable && (
        <p className="muted" role="status">
          The challenge list is unavailable. You can continue playing without a challenge.
        </p>
      )}
      {catalogAvailable && catalogEmpty && (
        <p className="muted" role="status">
          No challenges are available right now.
        </p>
      )}
      {exhausted && !catalogEmpty && (
        <p className="muted" role="status">
          That’s the full deck—every challenge has been played tonight.
        </p>
      )}
      {canControl && canDraw && (
        <button
          className="button"
          onClick={onDraw}
          disabled={busy || exhausted || !catalogAvailable}
        >
          {busy ? 'Drawing…' : currentRound ? 'Draw next challenge' : 'Draw a challenge'}
        </button>
      )}
    </section>
  );
}
