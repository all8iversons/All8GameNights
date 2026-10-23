import { useId, useState } from 'react';
import type { ChallengeRound } from '../game-night/types';
import { ChallengeTimer } from '../timer/ChallengeTimer';

interface TeammateOption {
  id: string;
  displayName: string;
}

interface ChallengePanelProps {
  playerName: string;
  teamName: string | null;
  currentRound: ChallengeRound | null;
  canControl: boolean;
  canDraw: boolean;
  exhausted: boolean;
  catalogEmpty: boolean;
  catalogAvailable: boolean;
  busy: boolean;
  tradeOptions: TeammateOption[];
  tradeBlockedByTimer: boolean;
  tradeBusy: boolean;
  timerBusy: boolean;
  onDraw: () => void;
  onTrade: (teammateId: string) => void;
  onTimerAction: (
    action: 'start' | 'pause' | 'resume' | 'reset' | 'finish',
    durationSeconds?: number,
  ) => void;
}

export function ChallengePanel({
  playerName,
  teamName,
  currentRound,
  canControl,
  canDraw,
  exhausted,
  catalogEmpty,
  catalogAvailable,
  busy,
  tradeOptions,
  tradeBlockedByTimer,
  tradeBusy,
  timerBusy,
  onDraw,
  onTrade,
  onTimerAction,
}: ChallengePanelProps) {
  const headingId = useId();
  const [teammateId, setTeammateId] = useState('');
  return (
    <section className="panel challenge-card" aria-labelledby={headingId}>
      <div>
        <div className="eyebrow">Bonus round</div>
        <h2 id={headingId}>{playerName}&apos;s challenge</h2>
        {teamName && <p className="muted challenge-team">{teamName}</p>}
      </div>
      {currentRound ? (
        <div className="challenge-content">
          <div>
            <h3>{currentRound.challenge.name}</h3>
            <p className="muted">{currentRound.challenge.instructions}</p>
            {currentRound.finishedAt && <p className="success">Challenge finished</p>}
          </div>
          {!currentRound.finishedAt && (
            <ChallengeTimer
              playerName={playerName}
              round={currentRound}
              canControl={canControl}
              busy={timerBusy}
              embedded
              onAction={onTimerAction}
            />
          )}
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
      {currentRound && !currentRound.finishedAt && tradeOptions.length > 0 && (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault();
            if (teammateId) onTrade(teammateId);
          }}
        >
          <label htmlFor={`${headingId}-trade`}>Trade challenge with a teammate</label>
          <select
            id={`${headingId}-trade`}
            className="field"
            value={teammateId}
            disabled={tradeBusy}
            onChange={(event) => setTeammateId(event.target.value)}
          >
            <option value="">Choose a teammate</option>
            {tradeOptions.map((teammate) => (
              <option key={teammate.id} value={teammate.id}>
                {teammate.displayName}
              </option>
            ))}
          </select>
          <button className="button secondary" type="submit" disabled={tradeBusy || !teammateId}>
            {tradeBusy ? 'Trading…' : 'Trade challenges'}
          </button>
          <p className="muted">
            Anyone with the room code can trade current challenges between teammates.
          </p>
        </form>
      )}
      {currentRound &&
        !currentRound.finishedAt &&
        tradeBlockedByTimer &&
        tradeOptions.length === 0 && (
          <p className="muted" role="status">
            Pause or stop both challenge timers before trading.
          </p>
        )}
    </section>
  );
}
