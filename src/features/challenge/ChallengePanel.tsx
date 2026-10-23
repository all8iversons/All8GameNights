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
  score?: number;
  currentRound: ChallengeRound | null;
  canControl: boolean;
  displayOnly?: boolean;
  canDraw: boolean;
  exhausted: boolean;
  catalogEmpty: boolean;
  catalogAvailable: boolean;
  busy: boolean;
  tradeOptions: TeammateOption[];
  tradeBlockedByTimer: boolean;
  tradeBusy: boolean;
  timerBusy: boolean;
  undoBusy: boolean;
  onDraw: () => void;
  onUndoFinish: () => void;
  onTrade: (teammateId: string) => void;
  onTimerAction: (
    action: 'start' | 'pause' | 'resume' | 'reset' | 'finish',
    durationSeconds?: number,
  ) => void;
}

export function ChallengePanel({
  playerName,
  teamName,
  score,
  currentRound,
  canControl,
  displayOnly = false,
  canDraw,
  exhausted,
  catalogEmpty,
  catalogAvailable,
  busy,
  tradeOptions,
  tradeBlockedByTimer,
  tradeBusy,
  timerBusy,
  undoBusy,
  onDraw,
  onUndoFinish,
  onTrade,
  onTimerAction,
}: ChallengePanelProps) {
  const headingId = useId();
  const [teammateId, setTeammateId] = useState('');
  const headingClassName = displayOnly
    ? 'challenge-card-heading wide-challenge-heading'
    : 'challenge-card-heading';
  return (
    <section className="panel challenge-card" aria-labelledby={headingId}>
      <div className={headingClassName}>
        <div>
          <h2 id={headingId}>{playerName}&apos;s challenge</h2>
          {teamName && <p className="muted challenge-team">{teamName}</p>}
        </div>
        {displayOnly && score !== undefined && (
          <strong className="wide-card-score" aria-label={`${score} points`}>
            {score}
          </strong>
        )}
      </div>
      {currentRound ? (
        <div className="challenge-content">
          <div>
            <h3>{currentRound.challenge.name}</h3>
            <p className="muted">{currentRound.challenge.instructions}</p>
            {currentRound.finishedAt && (
              <div className="challenge-finished">
                <p className="success">Challenge finished</p>
                {canControl && !displayOnly && (
                  <button
                    className="button secondary small"
                    onClick={onUndoFinish}
                    disabled={undoBusy}
                  >
                    {undoBusy ? 'Undoing…' : 'Undo finish'}
                  </button>
                )}
              </div>
            )}
          </div>
          {!currentRound.finishedAt && (
            <ChallengeTimer
              playerName={playerName}
              round={currentRound}
              canControl={canControl && !displayOnly}
              busy={timerBusy}
              embedded
              hideReadyStatus={displayOnly}
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
      {!displayOnly && exhausted && !catalogEmpty && (
        <p className="muted" role="status">
          That’s the full deck—every challenge has been played tonight.
        </p>
      )}
      {canControl && !displayOnly && canDraw && (
        <button
          className="button"
          onClick={() => {
            if (
              currentRound &&
              !currentRound.finishedAt &&
              !window.confirm(
                `Issue a new challenge to ${playerName}? Their current challenge will be finished, any running timer will stop, and the round will remain in history.`,
              )
            ) {
              return;
            }
            onDraw();
          }}
          disabled={busy || exhausted || !catalogAvailable}
        >
          {busy
            ? 'Drawing…'
            : currentRound && !currentRound.finishedAt
              ? 'Issue new challenge'
              : currentRound
                ? 'Draw next challenge'
                : 'Draw a challenge'}
        </button>
      )}
      {!displayOnly && currentRound && !currentRound.finishedAt && tradeOptions.length > 0 && (
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
      {!displayOnly &&
        currentRound &&
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
