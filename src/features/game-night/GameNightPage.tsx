import { useCallback, useState } from 'react';
import { ChallengePanel } from '../challenge/ChallengePanel';
import { ChallengeTimer } from '../timer/ChallengeTimer';
import { gameNightApi } from './game-night-api';
import { HostControls } from './HostControls';
import { Scoreboard } from './Scoreboard';
import { TeamControls } from './TeamControls';
import { useLiveGameNight } from './useLiveGameNight';
import { ErrorState, LoadingState } from '../../components/Feedback';
import { deriveWinners } from '../history/leaderboard-utils';

interface GameNightPageProps {
  spectatorCode: string;
  hostCapability: string | null;
  sessionWarning?: string;
  onLeave: () => void;
}

export function GameNightPage({
  spectatorCode,
  hostCapability,
  sessionWarning = '',
  onLeave,
}: GameNightPageProps) {
  const { gameNight, error, loading, refresh, setError, realtimeConnected } =
    useLiveGameNight(spectatorCode);
  const [busyAction, setBusyAction] = useState('');
  const isHost = Boolean(hostCapability);
  const exhausted = Boolean(
    gameNight && gameNight.challengeRounds.length >= gameNight.availableChallengeCount,
  );

  const onScore = useCallback(
    async (participantId: string, delta: number) => {
      try {
        await gameNightApi.updateScore(spectatorCode, participantId, delta);
        await refresh();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not update score.');
      }
    },
    [refresh, setError, spectatorCode],
  );

  async function drawChallenge(participantId: string) {
    if (!hostCapability) return;
    setBusyAction(`draw:${participantId}`);
    try {
      await gameNightApi.drawChallenge(spectatorCode, hostCapability, participantId);
      await refresh();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not draw a challenge.';
      setError(message);
    } finally {
      setBusyAction('');
    }
  }

  async function tradeChallenges(firstParticipantId: string, secondParticipantId: string) {
    setBusyAction(`trade:${firstParticipantId}:${secondParticipantId}`);
    try {
      await gameNightApi.tradeChallenges(spectatorCode, firstParticipantId, secondParticipantId);
      setError('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not trade challenges.');
    } finally {
      setBusyAction('');
    }
  }

  async function timerAction(
    roundId: string,
    action: 'start' | 'pause' | 'resume' | 'reset' | 'finish',
    durationSeconds?: number,
  ) {
    if (!hostCapability) return;
    setBusyAction(`timer:${roundId}`);
    try {
      await gameNightApi.timer(spectatorCode, hostCapability, roundId, action, durationSeconds);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update the timer.');
    } finally {
      setBusyAction('');
    }
  }

  async function completeGame() {
    if (!hostCapability || !window.confirm('End this game night and save the final scores?'))
      return;
    setBusyAction('complete');
    try {
      await gameNightApi.complete(spectatorCode, hostCapability);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not complete this game night.');
    } finally {
      setBusyAction('');
    }
  }

  if (loading) return <LoadingState message="Loading game night…" />;
  if (!gameNight) {
    return (
      <section className="panel stack">
        <ErrorState
          title="Game night unavailable"
          message={error || 'This game night could not be found.'}
        />
        <button className="button secondary" onClick={onLeave}>
          Back to start
        </button>
      </section>
    );
  }

  return (
    <>
      <div className="host-toolbar">
        <div>
          <div className="eyebrow">
            {gameNight.status === 'completed'
              ? 'Game complete'
              : isHost
                ? 'Host view'
                : 'Spectator view'}
          </div>
          <h1>{gameNight.status === 'completed' ? 'Final standings' : 'Game night is on'}</h1>
        </div>
        <button className="button secondary small" onClick={onLeave}>
          Leave board
        </button>
      </div>
      <p className="muted" role="status" style={{ maxWidth: 1000, margin: '0 auto 14px' }}>
        {realtimeConnected
          ? 'Live updates connected.'
          : 'Reconnecting to live updates; the board will refresh automatically.'}
      </p>
      {isHost && (
        <section className="panel stack" style={{ maxWidth: 1000, margin: '0 auto 18px' }}>
          <div>
            <p className="muted">Share this 6-digit join code with your players and viewers:</p>
            <code className="share-code">{spectatorCode}</code>
            <p className="muted">
              Host controls stay private. Anyone with the shared code can submit score changes under
              any player&apos;s name.
            </p>
            {hostCapability && (
              <details>
                <summary>Show host recovery key</summary>
                <p className="muted">
                  Keep this key private. Along with the room code, it restores host privileges on
                  another device.
                </p>
                <code className="host-recovery-key" aria-label="Host recovery key">
                  {hostCapability}
                </code>
              </details>
            )}
          </div>
        </section>
      )}
      {error && (
        <p className="alert" role="alert" style={{ maxWidth: 1000, margin: '0 auto 16px' }}>
          {error}
        </p>
      )}
      {sessionWarning && (
        <p className="alert" role="status" style={{ maxWidth: 1000, margin: '0 auto 16px' }}>
          {sessionWarning}
        </p>
      )}
      {gameNight.status === 'setup' && isHost && hostCapability && (
        <div className="game-layout">
          <HostControls
            spectatorCode={spectatorCode}
            hostCapability={hostCapability}
            status="setup"
            participants={gameNight.participants}
            onChanged={refresh}
            onError={setError}
          />
          <TeamControls
            spectatorCode={spectatorCode}
            hostCapability={hostCapability}
            participants={gameNight.participants}
            teams={gameNight.teams}
            onChanged={refresh}
            onError={setError}
          />
        </div>
      )}
      {gameNight.status === 'setup' && !isHost && (
        <section className="panel" style={{ maxWidth: 1000, margin: '0 auto 18px' }}>
          <p className="muted">
            The host is setting up the players. The live board will appear when the game starts.
          </p>
        </section>
      )}
      {gameNight.status !== 'setup' && (
        <div className="game-layout">
          {gameNight.status === 'active' && isHost && hostCapability && (
            <>
              <HostControls
                spectatorCode={spectatorCode}
                hostCapability={hostCapability}
                status="active"
                participants={gameNight.participants}
                onChanged={refresh}
                onError={setError}
              />
              <TeamControls
                spectatorCode={spectatorCode}
                hostCapability={hostCapability}
                participants={gameNight.participants}
                teams={gameNight.teams}
                onChanged={refresh}
                onError={setError}
              />
            </>
          )}
          <Scoreboard
            participants={gameNight.participants}
            teams={gameNight.teams}
            hostCapability={gameNight.status === 'active' ? hostCapability : null}
            canSubmitScores={gameNight.status === 'active'}
            onScore={onScore}
          />
          {gameNight.status === 'active' &&
            gameNight.participants.map((participant) => {
              const rounds = gameNight.challengeRounds.filter(
                (round) => round.participantId === participant.id,
              );
              const currentRound = rounds.at(-1) ?? null;
              const hasUnfinishedRound = rounds.some((round) => !round.finishedAt);
              const tradeCandidates = gameNight.participants.flatMap((teammate) => {
                if (
                  participant.teamId === null ||
                  teammate.id === participant.id ||
                  teammate.teamId !== participant.teamId
                ) {
                  return [];
                }
                const teammateRound = gameNight.challengeRounds.find(
                  (round) => round.participantId === teammate.id && !round.finishedAt,
                );
                return teammateRound ? [{ teammate, round: teammateRound }] : [];
              });
              const tradeOptions =
                currentRound && !currentRound.finishedAt && currentRound.timerStatus !== 'running'
                  ? tradeCandidates
                      .filter(({ round }) => round.timerStatus !== 'running')
                      .map(({ teammate: { id, displayName } }) => ({ id, displayName }))
                  : [];
              const tradeBlockedByTimer =
                currentRound?.timerStatus === 'running' ||
                (tradeCandidates.length > 0 &&
                  tradeCandidates.every(({ round }) => round.timerStatus === 'running'));
              return (
                <div className="player-round" key={participant.id}>
                  <ChallengePanel
                    playerName={participant.displayName}
                    currentRound={currentRound}
                    canControl={isHost}
                    canDraw={!hasUnfinishedRound}
                    exhausted={exhausted}
                    catalogEmpty={gameNight.availableChallengeCount === 0}
                    catalogAvailable={gameNight.challengeCatalogAvailable}
                    busy={busyAction === `draw:${participant.id}`}
                    tradeOptions={tradeOptions}
                    tradeBlockedByTimer={tradeBlockedByTimer}
                    tradeBusy={busyAction.startsWith('trade:')}
                    onDraw={() => void drawChallenge(participant.id)}
                    onTrade={(teammateId) =>
                      void tradeChallenges(participant.id, teammateId)
                    }
                  />
                  {hasUnfinishedRound && currentRound && (
                    <ChallengeTimer
                      playerName={participant.displayName}
                      round={currentRound}
                      canControl={isHost}
                      busy={busyAction === `timer:${currentRound.id}`}
                      onAction={(action, durationSeconds) =>
                        void timerAction(currentRound.id, action, durationSeconds)
                      }
                    />
                  )}
                </div>
              );
            })}
          {gameNight.status === 'completed' && (
            <section className="panel">
              <div className="eyebrow">Winners</div>
              <h2>
                {deriveWinners(gameNight.participants)
                  .map(({ displayName }) => displayName)
                  .join(' & ')}
              </h2>
              <p className="muted">Final scores are saved to the Hall of Fame.</p>
            </section>
          )}
          {isHost && gameNight.status === 'active' && hostCapability && (
            <section className="panel stack">
              <div>
                <div className="eyebrow">Ready to call it?</div>
                <h2>Finish the showdown</h2>
              </div>
              <button
                className="button secondary"
                disabled={busyAction === 'complete'}
                onClick={completeGame}
              >
                End game night
              </button>
            </section>
          )}
        </div>
      )}
    </>
  );
}
