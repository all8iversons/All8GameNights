import { describe, expect, it } from 'vitest';
import { createActiveGame, invoke } from './helpers';
import { integrationEnvironment } from './setup';

describe.skipIf(!integrationEnvironment.url || !integrationEnvironment.publishableKey)(
  'game-night functions',
  () => {
    it('lets the host rename an active player without renaming another player', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const path = `game-nights/${spectatorCode}`;
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string; displayName: string }> };
      }>(path);
      const [first, second] = snapshot.body.gameNight.participants;

      const renamed = await invoke<{ participant: { id: string; displayName: string } }>(
        `${path}/participants/${first.id}/rename`,
        {
          method: 'POST',
          hostCapability,
          body: { displayName: '  New Player Name  ' },
        },
      );
      expect(renamed.status).toBe(200);
      expect(renamed.body.participant.displayName).toBe('New Player Name');

      const duplicate = await invoke<{ error: { code: string } }>(
        `${path}/participants/${first.id}/rename`,
        {
          method: 'POST',
          hostCapability,
          body: { displayName: second.displayName },
        },
      );
      expect(duplicate.status).toBe(409);
      expect(duplicate.body.error.code).toBe('DUPLICATE_PARTICIPANT');

      const unauthorized = await invoke(
        `${path}/participants/${first.id}/rename`,
        { method: 'POST', body: { displayName: 'Unauthorized Rename' } },
      );
      expect(unauthorized.status).toBe(401);

      const updated = await invoke<{
        gameNight: { participants: Array<{ id: string; displayName: string }> };
      }>(path);
      expect(updated.body.gameNight.participants).toContainEqual({
        ...first,
        displayName: 'New Player Name',
      });
      expect(
        (
          await invoke(`${path}/complete`, {
            method: 'POST',
            hostCapability,
            body: {},
          })
        ).status,
      ).toBe(200);
      const completedRename = await invoke(
        `${path}/participants/${first.id}/rename`,
        {
          method: 'POST',
          hostCapability,
          body: { displayName: 'After Completion' },
        },
      );
      expect(completedRename.status).toBe(409);
    });

    it('allows only the host recovery key to restore host access', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const path = `game-nights/${spectatorCode}/host-session`;

      const recovered = await invoke<{ authorized: true }>(path, {
        method: 'POST',
        hostCapability,
        body: {},
      });
      expect(recovered.status).toBe(200);
      expect(recovered.body.authorized).toBe(true);

      const rejected = await invoke<{ error: { code: string } }>(path, {
        method: 'POST',
        hostCapability: '0'.repeat(64),
        body: {},
      });
      expect(rejected.status).toBe(401);
      expect(rejected.body.error.code).toBe('UNAUTHORIZED');
    });

    it('removes players without deleting their challenge history', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const snapshotPath = `game-nights/${spectatorCode}`;
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string; displayName: string }> };
      }>(snapshotPath);
      const [removedPlayer, remainingPlayer] = snapshot.body.gameNight.participants;
      const scoreIdempotencyKey = crypto.randomUUID();
      const score = await invoke(
        `game-nights/${spectatorCode}/participants/${removedPlayer.id}/score`,
        {
          method: 'POST',
          body: { delta: 100, idempotencyKey: scoreIdempotencyKey },
        },
      );
      expect(score.status).toBe(200);
      const draw = await invoke<{
        challengeRound: { id: string };
      }>(`game-nights/${spectatorCode}/challenge-draws`, {
        method: 'POST',
        hostCapability,
        body: { participantId: removedPlayer.id, idempotencyKey: crypto.randomUUID() },
      });
      expect(draw.status).toBe(201);
      expect(
        (
          await invoke(
            `game-nights/${spectatorCode}/challenge-rounds/${draw.body.challengeRound.id}/timer`,
            {
              method: 'POST',
              hostCapability,
              body: { action: 'start', durationSeconds: 60 },
            },
          )
        ).status,
      ).toBe(200);

      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants/${removedPlayer.id}/remove`, {
            method: 'POST',
            hostCapability,
            body: {},
          })
        ).status,
      ).toBe(200);
      const afterRemoval = await invoke<{
        gameNight: {
          participants: Array<{ id: string }>;
          challengeRounds: Array<{
            id: string;
            participantId: string;
            finishedAt: string | null;
            timerStatus: string;
          }>;
        };
      }>(snapshotPath);
      expect(afterRemoval.body.gameNight.participants.map(({ id }) => id)).toEqual([
        remainingPlayer.id,
      ]);
      expect(afterRemoval.body.gameNight.challengeRounds).toHaveLength(1);
      expect(afterRemoval.body.gameNight.challengeRounds[0]).toMatchObject({
        participantId: removedPlayer.id,
        timerStatus: 'stopped',
      });
      expect(afterRemoval.body.gameNight.challengeRounds[0].finishedAt).not.toBeNull();

      const rejectedScore = await invoke<{ error: { code: string } }>(
        `game-nights/${spectatorCode}/participants/${removedPlayer.id}/score`,
        {
          method: 'POST',
          body: { delta: 100, idempotencyKey: scoreIdempotencyKey },
        },
      );
      expect(rejectedScore.status).toBe(404);
      expect(rejectedScore.body.error.code).toBe('NOT_FOUND');

      const readded = await invoke<{ participant: { id: string } }>(
        `game-nights/${spectatorCode}/participants`,
        {
          method: 'POST',
          hostCapability,
          body: { displayName: removedPlayer.displayName },
        },
      );
      expect(readded.status).toBe(201);
      expect(readded.body.participant.id).not.toBe(removedPlayer.id);
    });

    it('trades current challenges only between teammates and blocks running timers', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const snapshotPath = `game-nights/${spectatorCode}`;
      const initial = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(snapshotPath);
      const [first, second] = initial.body.gameNight.participants;
      const team = await invoke<{ team: { id: string } }>(`game-nights/${spectatorCode}/teams`, {
        method: 'POST',
        hostCapability,
        body: { name: `Trade test ${crypto.randomUUID()}` },
      });
      for (const participant of [first, second]) {
        expect(
          (
            await invoke(
              `game-nights/${spectatorCode}/participants/${participant.id}/team`,
              {
                method: 'POST',
                hostCapability,
                body: { teamId: team.body.team.id },
              },
            )
          ).status,
        ).toBe(200);
      }

      for (const participant of [first, second]) {
        expect(
          (
            await invoke(`game-nights/${spectatorCode}/challenge-draws`, {
              method: 'POST',
              hostCapability,
              body: { participantId: participant.id, idempotencyKey: crypto.randomUUID() },
            })
          ).status,
        ).toBe(201);
      }

      const beforeTrade = await invoke<{
        gameNight: {
          challengeRounds: Array<{
            challenge: { id: string };
            participantId: string;
          }>;
        };
      }>(snapshotPath);
      const tradePath = `game-nights/${spectatorCode}/challenge-trades`;
      const trade = {
        firstParticipantId: first.id,
        secondParticipantId: second.id,
        idempotencyKey: crypto.randomUUID(),
      };
      expect(
        (await invoke(tradePath, { method: 'POST', body: trade })).status,
      ).toBe(200);
      expect(
        (await invoke(tradePath, { method: 'POST', body: trade })).status,
      ).toBe(200);

      const swapped = await invoke<{
        gameNight: {
          challengeRounds: Array<{
            challenge: { id: string };
            id: string;
            participantId: string;
          }>;
        };
      }>(snapshotPath);
      const firstRound = swapped.body.gameNight.challengeRounds.find(
        ({ participantId }) => participantId === first.id,
      );
      const originalFirstRound = beforeTrade.body.gameNight.challengeRounds.find(
        ({ participantId }) => participantId === first.id,
      );
      const originalSecondRound = beforeTrade.body.gameNight.challengeRounds.find(
        ({ participantId }) => participantId === second.id,
      );
      expect(firstRound).toBeDefined();
      expect(originalFirstRound).toBeDefined();
      expect(originalSecondRound).toBeDefined();
      if (!firstRound) throw new Error('First player has no active round after the trade.');
      if (!originalSecondRound)
        throw new Error('Second player has no active round before the trade.');
      expect(firstRound.challenge.id).toBe(originalSecondRound.challenge.id);
      const secondRound = swapped.body.gameNight.challengeRounds.find(
        ({ participantId }) => participantId === second.id,
      );
      if (!secondRound) throw new Error('Second player has no active round after the trade.');
      if (!originalFirstRound)
        throw new Error('First player has no active round before the trade.');
      expect(secondRound.challenge.id).toBe(originalFirstRound.challenge.id);
      const runningRoundId = firstRound.id;
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/challenge-rounds/${runningRoundId}/timer`, {
            method: 'POST',
            hostCapability,
            body: { action: 'start', durationSeconds: 60 },
          })
        ).status,
      ).toBe(200);

      const blockedTrade = await invoke<{ error: { code: string } }>(tradePath, {
        method: 'POST',
        body: { ...trade, idempotencyKey: crypto.randomUUID() },
      });
      expect(blockedTrade.status).toBe(409);
      expect(blockedTrade.body.error.code).toBe('CHALLENGE_TIMER_RUNNING');

      const otherTeam = await invoke<{ team: { id: string } }>(
        `game-nights/${spectatorCode}/teams`,
        {
          method: 'POST',
          hostCapability,
          body: { name: `Other trade team ${crypto.randomUUID()}` },
        },
      );
      expect(otherTeam.status).toBe(201);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants/${second.id}/team`, {
            method: 'POST',
            hostCapability,
            body: { teamId: otherTeam.body.team.id },
          })
        ).status,
      ).toBe(200);
      const crossTeamTrade = await invoke<{ error: { code: string } }>(tradePath, {
        method: 'POST',
        body: { ...trade, idempotencyKey: crypto.randomUUID() },
      });
      expect(crossTeamTrade.status).toBe(409);
      expect(crossTeamTrade.body.error.code).toBe('PLAYERS_NOT_TEAMMATES');
    });

    it('updates scores idempotently and exposes the same authoritative snapshot to spectators', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      expect(spectatorCode).toMatch(/^\d{6}$/);
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string; score: number }> };
      }>(`game-nights/${spectatorCode}`);
      const participant = snapshot.body.gameNight.participants[0];
      const request = {
        delta: 100,
        idempotencyKey: crypto.randomUUID(),
      };
      const path = `game-nights/${spectatorCode}/participants/${participant.id}/score`;
      expect((await invoke(path, { method: 'POST', hostCapability, body: request })).status).toBe(
        200,
      );
      expect((await invoke(path, { method: 'POST', hostCapability, body: request })).status).toBe(
        200,
      );
      const updated = await invoke<{ gameNight: { participants: Array<{ score: number }> } }>(
        `game-nights/${spectatorCode}`,
      );
      expect(updated.body.gameNight.participants[0].score).toBe(100);
      expect(
        (
          await invoke(path, {
            method: 'POST',
            body: { delta: 50, idempotencyKey: 'player-score' },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await invoke(path, {
            method: 'POST',
            body: { delta: 60, idempotencyKey: request.idempotencyKey },
          })
        ).status,
      ).toBe(200);
      const idempotentRetry = await invoke<{
        gameNight: { participants: Array<{ score: number }> };
      }>(`game-nights/${spectatorCode}`);
      expect(idempotentRetry.body.gameNight.participants[0].score).toBe(150);
    });

    it('rejects invalid score changes and enforces the public score rate limit', async () => {
      const { spectatorCode } = await createActiveGame();
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(`game-nights/${spectatorCode}`);
      const participantId = snapshot.body.gameNight.participants[0].id;
      const path = `game-nights/${spectatorCode}/participants/${participantId}/score`;
      for (const delta of [0, 1.5, 10001]) {
        expect(
          (
            await invoke(path, {
              method: 'POST',
              body: { delta, idempotencyKey: crypto.randomUUID() },
            })
          ).status,
        ).toBe(400);
      }
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants/${crypto.randomUUID()}/score`, {
            method: 'POST',
            body: { delta: 1, idempotencyKey: crypto.randomUUID() },
          })
        ).status,
      ).toBe(404);

      const scoreIp = `integration-score-${crypto.randomUUID()}`;
      for (let count = 0; count < 120; count += 1) {
        const result = await invoke(path, {
          method: 'POST',
          headers: { 'x-forwarded-for': scoreIp },
          body: { delta: 1, idempotencyKey: crypto.randomUUID() },
        });
        expect(result.status).toBe(200);
      }
      expect(
        (
          await invoke(path, {
            method: 'POST',
            headers: { 'x-forwarded-for': scoreIp },
            body: { delta: 1, idempotencyKey: crypto.randomUUID() },
          })
        ).status,
      ).toBe(429);
    });

    it('rate limits repeated invalid join-code attempts by source IP', async () => {
      const { spectatorCode } = await createActiveGame();
      const invalidCode = String((Number(spectatorCode) + 1) % 1_000_000).padStart(6, '0');
      const sourceIp = `integration-join-${crypto.randomUUID()}`;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        expect(
          (
            await invoke(`game-nights/${invalidCode}`, {
              headers: { 'x-forwarded-for': sourceIp },
            })
          ).status,
        ).toBe(404);
      }
      expect(
        (
          await invoke(`game-nights/${invalidCode}`, {
            headers: { 'x-forwarded-for': sourceIp },
          })
        ).status,
      ).toBe(429);
    });

    it('generates balanced space-named teams by team count or team size without changing scores', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const initial = await invoke<{
        gameNight: { participants: Array<{ id: string; score: number }> };
      }>(`game-nights/${spectatorCode}`);
      const players = initial.body.gameNight.participants;
      await invoke(`game-nights/${spectatorCode}/participants/${players[0].id}/score`, {
        method: 'POST',
        body: { delta: 250, idempotencyKey: crypto.randomUUID() },
      });
      const oldTeam = await invoke<{ team: { id: string } }>(`game-nights/${spectatorCode}/teams`, {
        method: 'POST',
        hostCapability,
        body: { name: 'Legacy Team' },
      });
      await invoke(`game-nights/${spectatorCode}/participants/${players[0].id}/team`, {
        method: 'POST',
        hostCapability,
        body: { teamId: oldTeam.body.team.id },
      });

      const endpoint = `game-nights/${spectatorCode}/teams/generate`;
      const byTeamCount = await invoke(endpoint, {
        method: 'POST',
        hostCapability,
        body: { mode: 'team_count', count: 2 },
      });
      expect(byTeamCount.status).toBe(200);
      type TeamSnapshot = {
        gameNight: {
          participants: Array<{ id: string; score: number; teamId: string | null }>;
          teams: Array<{ id: string; name: string; score: number }>;
        };
      };
      let snapshot = await invoke<TeamSnapshot>(`game-nights/${spectatorCode}`);
      expect(snapshot.body.gameNight.teams).toHaveLength(2);
      expect(new Set(snapshot.body.gameNight.teams.map(({ name }) => name)).size).toBe(2);
      expect(snapshot.body.gameNight.teams.some(({ id }) => id === oldTeam.body.team.id)).toBe(
        false,
      );
      expect(
        snapshot.body.gameNight.teams.every(({ name }) =>
          /Aurora|Nebula|Comet|Lunar|Nova|Orbit|Cosmic|Solar|Stellar|Meteor/.test(name),
        ),
      ).toBe(true);
      const teamSizes = snapshot.body.gameNight.teams.map(
        ({ id }) =>
          snapshot.body.gameNight.participants.filter(({ teamId }) => teamId === id).length,
      );
      expect(Math.abs(teamSizes[0] - teamSizes[1])).toBeLessThanOrEqual(1);
      expect(
        snapshot.body.gameNight.participants.find(({ id }) => id === players[0].id)?.score,
      ).toBe(250);

      const byPlayersPerTeam = await invoke(endpoint, {
        method: 'POST',
        hostCapability,
        body: { mode: 'players_per_team', count: 1 },
      });
      expect(byPlayersPerTeam.status).toBe(200);
      snapshot = await invoke<TeamSnapshot>(`game-nights/${spectatorCode}`);
      expect(snapshot.body.gameNight.teams).toHaveLength(players.length);
      expect(snapshot.body.gameNight.participants.every(({ teamId }) => teamId !== null)).toBe(
        true,
      );
      expect(
        snapshot.body.gameNight.participants.find(({ id }) => id === players[0].id)?.score,
      ).toBe(250);

      for (const body of [
        { mode: 'team_count', count: 0 },
        { mode: 'team_count', count: players.length + 1 },
        { mode: 'players_per_team', count: players.length + 1 },
      ]) {
        expect(
          (
            await invoke(endpoint, {
              method: 'POST',
              hostCapability,
              body,
            })
          ).status,
        ).toBe(400);
      }
    });

    it('adds players during active play and derives team scores from their individual scores', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const initial = await invoke<{
        gameNight: { participants: Array<{ id: string; score: number }> };
      }>(`game-nights/${spectatorCode}`);
      const participantId = initial.body.gameNight.participants[0].id;

      const added = await invoke<{ participant: { id: string; score: number } }>(
        `game-nights/${spectatorCode}/participants`,
        { method: 'POST', hostCapability, body: { displayName: 'Late Player' } },
      );
      expect(added.status).toBe(201);
      expect(added.body.participant.score).toBe(0);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants`, {
            method: 'POST',
            hostCapability,
            body: { displayName: 'late player' },
          })
        ).status,
      ).toBe(409);

      const createdTeam = await invoke<{ team: { id: string } }>(
        `game-nights/${spectatorCode}/teams`,
        { method: 'POST', hostCapability, body: { name: 'Team One' } },
      );
      expect(createdTeam.status).toBe(201);
      const secondTeam = await invoke<{ team: { id: string } }>(
        `game-nights/${spectatorCode}/teams`,
        { method: 'POST', hostCapability, body: { name: 'Team Two' } },
      );
      expect(secondTeam.status).toBe(201);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/teams`, {
            method: 'POST',
            hostCapability,
            body: { name: 'team one' },
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/teams/${createdTeam.body.team.id}`, {
            method: 'POST',
            hostCapability,
            body: { name: 'Renamed Team' },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants/${participantId}/team`, {
            method: 'POST',
            hostCapability,
            body: { teamId: createdTeam.body.team.id },
          })
        ).status,
      ).toBe(200);

      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants/${participantId}/score`, {
            method: 'POST',
            body: { delta: 100, idempotencyKey: crypto.randomUUID() },
          })
        ).status,
      ).toBe(200);
      const updated = await invoke<{
        gameNight: {
          participants: Array<{ id: string; score: number }>;
          teams: Array<{ id: string; score: number }>;
        };
      }>(`game-nights/${spectatorCode}`);
      expect(
        updated.body.gameNight.participants.find(({ id }) => id === participantId)?.score,
      ).toBe(100);
      expect(
        updated.body.gameNight.teams.find(({ id }) => id === createdTeam.body.team.id)?.score,
      ).toBe(100);

      expect(
        (
          await invoke(`game-nights/${spectatorCode}/teams/randomize`, {
            method: 'POST',
            hostCapability,
            body: {},
          })
        ).status,
      ).toBe(200);
      const randomized = await invoke<{
        gameNight: {
          participants: Array<{ teamId: string | null }>;
          teams: Array<{ id: string }>;
        };
      }>(`game-nights/${spectatorCode}`);
      const randomizedAssignments = randomized.body.gameNight.participants.map(
        ({ teamId }) => teamId,
      );
      expect(
        randomizedAssignments.every((teamId) =>
          [createdTeam.body.team.id, secondTeam.body.team.id].includes(teamId ?? ''),
        ),
      ).toBe(true);
      expect(
        Math.abs(
          randomizedAssignments.filter((teamId) => teamId === createdTeam.body.team.id).length -
            randomizedAssignments.filter((teamId) => teamId === secondTeam.body.team.id).length,
        ),
      ).toBeLessThanOrEqual(1);

      const { spectatorCode: otherNightCode, hostCapability: otherHost } = await createActiveGame();
      const otherTeam = await invoke<{ team: { id: string } }>(
        `game-nights/${otherNightCode}/teams`,
        { method: 'POST', hostCapability: otherHost, body: { name: 'Other Night Team' } },
      );
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants/${participantId}/team`, {
            method: 'POST',
            hostCapability,
            body: { teamId: otherTeam.body.team.id },
          })
        ).status,
      ).toBe(404);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/teams/${createdTeam.body.team.id}/delete`, {
            method: 'POST',
            hostCapability,
            body: {},
          })
        ).status,
      ).toBe(200);
      const afterRemoval = await invoke<{
        gameNight: {
          participants: Array<{ id: string; teamId: string | null }>;
          teams: Array<{ id: string }>;
        };
      }>(`game-nights/${spectatorCode}`);
      expect(
        afterRemoval.body.gameNight.participants.some(
          ({ teamId }) => teamId === createdTeam.body.team.id,
        ),
      ).toBe(false);
      expect(
        afterRemoval.body.gameNight.teams.some(({ id }) => id === createdTeam.body.team.id),
      ).toBe(false);
    });

    it('assigns unique challenges to players and controls their timers independently', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(`game-nights/${spectatorCode}`);
      const [first, second] = snapshot.body.gameNight.participants;

      const drawFirst = await invoke<{ challengeRound: { id: string; participantId: string } }>(
        `game-nights/${spectatorCode}/challenge-draws`,
        {
          method: 'POST',
          hostCapability,
          body: { participantId: first.id, idempotencyKey: crypto.randomUUID() },
        },
      );
      const drawSecond = await invoke<{ challengeRound: { id: string; participantId: string } }>(
        `game-nights/${spectatorCode}/challenge-draws`,
        {
          method: 'POST',
          hostCapability,
          body: { participantId: second.id, idempotencyKey: crypto.randomUUID() },
        },
      );
      expect(drawFirst.status).toBe(201);
      expect(drawSecond.status).toBe(201);
      expect(drawFirst.body.challengeRound.participantId).toBe(first.id);
      expect(drawSecond.body.challengeRound.participantId).toBe(second.id);

      for (const roundId of [drawFirst.body.challengeRound.id, drawSecond.body.challengeRound.id]) {
        expect(
          (
            await invoke(`game-nights/${spectatorCode}/challenge-rounds/${roundId}/timer`, {
              method: 'POST',
              hostCapability,
              body: { action: 'start', durationSeconds: 60 },
            })
          ).status,
        ).toBe(200);
      }
      await invoke(
        `game-nights/${spectatorCode}/challenge-rounds/${drawFirst.body.challengeRound.id}/timer`,
        {
          method: 'POST',
          hostCapability,
          body: { action: 'pause' },
        },
      );
      const independentlyPaused = await invoke<{
        gameNight: {
          challengeRounds: Array<{ id: string; timerStatus: string }>;
        };
      }>(`game-nights/${spectatorCode}`);
      expect(
        independentlyPaused.body.gameNight.challengeRounds.find(
          ({ id }) => id === drawFirst.body.challengeRound.id,
        )?.timerStatus,
      ).toBe('paused');
      expect(
        independentlyPaused.body.gameNight.challengeRounds.find(
          ({ id }) => id === drawSecond.body.challengeRound.id,
        )?.timerStatus,
      ).toBe('running');

      await invoke(
        `game-nights/${spectatorCode}/challenge-rounds/${drawFirst.body.challengeRound.id}/timer`,
        {
          method: 'POST',
          hostCapability,
          body: { action: 'finish' },
        },
      );
      const nextRound = await invoke(`game-nights/${spectatorCode}/challenge-draws`, {
        method: 'POST',
        hostCapability,
        body: { participantId: first.id, idempotencyKey: crypto.randomUUID() },
      });
      expect(nextRound.status).toBe(201);
    });
  },
);
