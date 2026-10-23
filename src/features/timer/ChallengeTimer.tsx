import { useEffect, useId, useState } from 'react';
import type { ChallengeRound } from '../game-night/types';
import { formatTime, isValidTimerDuration, secondsRemaining } from './timer-utils';

interface ChallengeTimerProps {
  playerName: string;
  round: ChallengeRound | null;
  canControl: boolean;
  busy: boolean;
  embedded?: boolean;
  hideReadyStatus?: boolean;
  onAction: (
    action: 'start' | 'pause' | 'resume' | 'reset' | 'finish',
    durationSeconds?: number,
  ) => void;
}

function remainingSecondsForRound(round: ChallengeRound | null): number {
  if (!round) return 0;
  if (round.timerStatus === 'paused') return round.pausedRemainingSeconds ?? 0;
  if (round.timerStatus === 'running' && round.deadlineAt) {
    return secondsRemaining(round.deadlineAt);
  }
  return round.durationSeconds ?? 0;
}

export function ChallengeTimer({
  playerName,
  round,
  canControl,
  busy,
  embedded = false,
  hideReadyStatus = false,
  onAction,
}: ChallengeTimerProps) {
  const id = useId();
  const headingId = `${id}-heading`;
  const durationId = `${id}-duration`;
  const [duration, setDuration] = useState('60');
  const [remaining, setRemaining] = useState(() => remainingSecondsForRound(round));

  useEffect(() => {
    setRemaining(remainingSecondsForRound(round));
    if (round?.timerStatus !== 'running') return;
    const interval = window.setInterval(() => setRemaining(remainingSecondsForRound(round)), 200);
    return () => window.clearInterval(interval);
  }, [round]);

  const status = round?.timerStatus ?? 'ready';
  const expired = status === 'expired' || (status === 'running' && remaining === 0);
  const content = (
    <>
      {!embedded && (
        <div>
          <div className="eyebrow">Beat the clock</div>
          <h2 id={headingId}>{playerName}&apos;s timer</h2>
        </div>
      )}
      <div
        className={expired ? 'timer expired' : 'timer'}
        role="timer"
        aria-label={`${formatTime(remaining)} remaining`}
      >
        {formatTime(remaining)}
      </div>
      {!(hideReadyStatus && status === 'ready') && (
        <p className={expired ? 'success' : 'muted'} role="status" aria-live="polite">
          {expired
            ? 'Time is up!'
            : status === 'running'
              ? 'Timer running'
              : status === 'paused'
                ? 'Timer paused'
                : 'Ready when you are'}
        </p>
      )}
      {canControl && (
        <div className="timer-controls">
          {status !== 'running' && status !== 'paused' && (
            <>
              <label className="sr-only" htmlFor={durationId}>
                Timer duration for {playerName}
              </label>
              <input
                id={durationId}
                className="field"
                type="number"
                min="1"
                step="1"
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                aria-label={`Timer duration for ${playerName} in seconds`}
              />
              <button
                className="button"
                onClick={() => onAction('start', Number(duration))}
                disabled={busy || !isValidTimerDuration(Number(duration)) || !round}
              >
                Start
              </button>
            </>
          )}
          {status === 'running' && (
            <button className="button secondary" onClick={() => onAction('pause')} disabled={busy}>
              Pause
            </button>
          )}
          {status === 'paused' && (
            <button className="button" onClick={() => onAction('resume')} disabled={busy}>
              Resume
            </button>
          )}
          {(status === 'running' || status === 'paused' || status === 'expired') && (
            <button className="button secondary" onClick={() => onAction('reset')} disabled={busy}>
              Reset
            </button>
          )}
          {round && (
            <button className="button secondary" onClick={() => onAction('finish')} disabled={busy}>
              Finish challenge
            </button>
          )}
        </div>
      )}
    </>
  );

  return embedded ? (
    <div className="challenge-timer stack" role="group" aria-label={`${playerName} timer`}>
      {content}
    </div>
  ) : (
    <section className="panel stack" aria-labelledby={headingId}>
      {content}
    </section>
  );
}
