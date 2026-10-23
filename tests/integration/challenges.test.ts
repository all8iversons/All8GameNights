import { describe, expect, it } from 'vitest';
import { createActiveGame, invoke } from './helpers';
import { integrationEnvironment } from './setup';

describe.skipIf(!integrationEnvironment.url || !integrationEnvironment.publishableKey)(
  'challenge functions',
  () => {
    it('only reopens the most recently finished challenge and keeps its timer ready', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const basePath = `game-nights/${spectatorCode}`;
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(basePath);
      const participantId = snapshot.body.gameNight.participants[0].id;
      const draw = async () =>
        invoke<{ challengeRound: { id: string } }>(`${basePath}/challenge-draws`, {
          method: 'POST',
          hostCapability,
          body: { participantId, idempotencyKey: crypto.randomUUID() },
        });
      const finish = async (roundId: string) =>
        invoke(`${basePath}/challenge-rounds/${roundId}/timer`, {
          method: 'POST',
          hostCapability,
          body: { action: 'finish' },
        });
      const first = await draw();
      expect(first.status).toBe(201);
      expect((await finish(first.body.challengeRound.id)).status).toBe(200);
      const second = await draw();
      expect(second.status).toBe(201);
      expect((await finish(second.body.challengeRound.id)).status).toBe(200);

      const olderUndo = await invoke(
        `${basePath}/challenge-rounds/${first.body.challengeRound.id}/undo-finish`,
        { method: 'POST', hostCapability, body: {} },
      );
      expect(olderUndo.status).toBe(409);

      const latestUndo = await invoke<{
        challengeRound: { finishedAt: string | null; timerStatus: string };
      }>(`${basePath}/challenge-rounds/${second.body.challengeRound.id}/undo-finish`, {
        method: 'POST',
        hostCapability,
        body: {},
      });
      expect(latestUndo.status).toBe(200);
      expect(latestUndo.body.challengeRound).toMatchObject({
        finishedAt: null,
        timerStatus: 'ready',
      });
      const undoWithOpenRound = await invoke(
        `${basePath}/challenge-rounds/${first.body.challengeRound.id}/undo-finish`,
        { method: 'POST', hostCapability, body: {} },
      );
      expect(undoWithOpenRound.status).toBe(409);
      const updated = await invoke<{
        gameNight: {
          challengeRounds: Array<{ id: string; finishedAt: string | null }>;
        };
      }>(basePath);
      expect(
        updated.body.gameNight.challengeRounds.find(
          ({ id }) => id === first.body.challengeRound.id,
        )?.finishedAt,
      ).not.toBeNull();
      expect(
        updated.body.gameNight.challengeRounds.find(
          ({ id }) => id === second.body.challengeRound.id,
        ),
      ).toMatchObject({ finishedAt: null });
    });

    it('lets a host issue a replacement challenge and preserves the stopped round', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const path = `game-nights/${spectatorCode}`;
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(path);
      const participantId = snapshot.body.gameNight.participants[0].id;
      const firstDraw = await invoke<{
        challengeRound: { id: string; challenge: { id: string } };
      }>(`${path}/challenge-draws`, {
        method: 'POST',
        hostCapability,
        body: { participantId, idempotencyKey: crypto.randomUUID() },
      });
      expect(firstDraw.status).toBe(201);

      const started = await invoke(
        `${path}/challenge-rounds/${firstDraw.body.challengeRound.id}/timer`,
        {
          method: 'POST',
          hostCapability,
          body: { action: 'start', durationSeconds: 60 },
        },
      );
      expect(started.status).toBe(200);

      const secondDraw = await invoke<{
        challengeRound: { id: string; challenge: { id: string } };
      }>(`${path}/challenge-draws`, {
        method: 'POST',
        hostCapability,
        body: { participantId, idempotencyKey: crypto.randomUUID() },
      });
      expect(secondDraw.status).toBe(201);
      expect(secondDraw.body.challengeRound.id).not.toBe(firstDraw.body.challengeRound.id);
      expect(secondDraw.body.challengeRound.challenge.id).not.toBe(
        firstDraw.body.challengeRound.challenge.id,
      );

      const updated = await invoke<{
        gameNight: {
          challengeRounds: Array<{
            id: string;
            participantId: string;
            finishedAt: string | null;
            timerStatus: string;
          }>;
        };
      }>(path);
      const previousRound = updated.body.gameNight.challengeRounds.find(
        ({ id }) => id === firstDraw.body.challengeRound.id,
      );
      const replacementRound = updated.body.gameNight.challengeRounds.find(
        ({ id }) => id === secondDraw.body.challengeRound.id,
      );
      expect(updated.body.gameNight.challengeRounds).toHaveLength(2);
      expect(previousRound).toMatchObject({
        participantId,
        timerStatus: 'stopped',
      });
      expect(previousRound?.finishedAt).not.toBeNull();
      expect(replacementRound?.finishedAt).toBeNull();
    });

    it('lets a host add and edit shared challenges, including assigned challenges', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const path = `game-nights/${spectatorCode}/challenges`;
      const unauthorized = await invoke(path);
      expect(unauthorized.status).toBe(401);

      const initial = await invoke<{
        challenges: Array<{
          id: string;
          name: string;
          instructions: string;
          enabled: boolean;
        }>;
      }>(path, { hostCapability });
      expect(initial.status).toBe(200);

      const unique = crypto.randomUUID();
      const created = await invoke<{
        challenge: { id: string; name: string; enabled: boolean };
      }>(path, {
        method: 'POST',
        hostCapability,
        body: { name: `Integration challenge ${unique}`, instructions: 'A temporary test challenge.' },
      });
      expect(created.status).toBe(201);
      expect(created.body.challenge.enabled).toBe(true);

      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(`game-nights/${spectatorCode}`);
      const drawn = await invoke<{
        challengeRound: { id: string; challenge: { id: string } };
      }>(`game-nights/${spectatorCode}/challenge-draws`, {
        method: 'POST',
        hostCapability,
        body: {
          participantId: snapshot.body.gameNight.participants[0].id,
          idempotencyKey: crypto.randomUUID(),
        },
      });
      expect(drawn.status).toBe(201);
      const original = initial.body.challenges.find(
        ({ id }) => id === drawn.body.challengeRound.challenge.id,
      );
      if (!original) throw new Error('Drawn challenge is missing from the shared catalog.');

      const editedName = `${original.name} ${unique.slice(0, 8)}`;
      try {
        const edited = await invoke<{
          challenge: { id: string; name: string; instructions: string; enabled: boolean };
        }>(`${path}/${original.id}`, {
          method: 'POST',
          hostCapability,
          body: {
            name: editedName,
            instructions: 'Updated instructions appear on current assignments.',
            enabled: original.enabled,
          },
        });
        expect(edited.status).toBe(200);
        const updatedSnapshot = await invoke<{
          gameNight: {
            challengeRounds: Array<{
              id: string;
              challenge: { id: string; name: string; instructions: string };
            }>;
          };
        }>(`game-nights/${spectatorCode}`);
        expect(
          updatedSnapshot.body.gameNight.challengeRounds.find(
            ({ id }) => id === drawn.body.challengeRound.id,
          )?.challenge,
        ).toMatchObject({
          id: original.id,
          name: editedName,
          instructions: 'Updated instructions appear on current assignments.',
        });

        const disabled = await invoke(`${path}/${original.id}`, {
          method: 'POST',
          hostCapability,
          body: {
            name: editedName,
            instructions: 'Updated instructions appear on current assignments.',
            enabled: false,
          },
        });
        expect(disabled.status).toBe(200);
        const anotherDraw = await invoke<{
          challengeRound: { challenge: { id: string } };
        }>(`game-nights/${spectatorCode}/challenge-draws`, {
          method: 'POST',
          hostCapability,
          body: {
            participantId: snapshot.body.gameNight.participants[1].id,
            idempotencyKey: crypto.randomUUID(),
          },
        });
        expect(anotherDraw.status).toBe(201);
        expect(anotherDraw.body.challengeRound.challenge.id).not.toBe(original.id);
      } finally {
        const restored = await invoke(`${path}/${original.id}`, {
          method: 'POST',
          hostCapability,
          body: original,
        });
        expect(restored.status).toBe(200);
        const archived = await invoke(`${path}/${created.body.challenge.id}`, {
          method: 'POST',
          hostCapability,
          body: {
            name: created.body.challenge.name,
            instructions: 'A temporary test challenge.',
            enabled: false,
          },
        });
        expect(archived.status).toBe(200);
      }
    });

    it('draws unique challenges under concurrent requests and rejects repeats after exhaustion', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const snapshot = await invoke<{
        gameNight: { participants: Array<{ id: string }> };
      }>(`game-nights/${spectatorCode}`);
      const [firstParticipant, secondParticipant] = snapshot.body.gameNight.participants;
      const draw = (participantId: string) =>
        invoke<{
          challengeRound?: { id: string; challenge: { id: string } };
          error?: { code: string };
        }>(`game-nights/${spectatorCode}/challenge-draws`, {
          method: 'POST',
          hostCapability,
          body: { participantId, idempotencyKey: crypto.randomUUID() },
        });
      const firstPair = await Promise.all([
        draw(firstParticipant.id),
        draw(secondParticipant.id),
      ]);
      expect(firstPair.every(({ status }) => status === 201)).toBe(true);
      expect(
        firstPair.map(({ body }) => body.challengeRound?.challenge.id).filter(Boolean),
      ).toHaveLength(new Set(firstPair.map(({ body }) => body.challengeRound?.challenge.id)).size);
      const seen = new Set(
        firstPair.map(({ body }) => body.challengeRound?.challenge.id).filter(Boolean),
      );
      const firstRound = firstPair[0].body.challengeRound;
      if (!firstRound) throw new Error('Concurrent challenge draw did not return a round.');
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/challenge-rounds/${firstRound.id}/timer`, {
            method: 'POST',
            hostCapability,
            body: { action: 'start', durationSeconds: 30 },
          })
        ).status,
      ).toBe(200);
      const secondRound = firstPair[1].body.challengeRound;
      if (!secondRound) throw new Error('Concurrent challenge draw did not return a second round.');
      await invoke(
        `game-nights/${spectatorCode}/challenge-rounds/${secondRound.id}/timer`,
        { method: 'POST', hostCapability, body: { action: 'finish' } },
      );
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/challenge-rounds/${firstRound.id}/timer`, {
            method: 'POST',
            hostCapability,
            body: { action: 'pause' },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/challenge-rounds/${firstRound.id}/timer`, {
            method: 'POST',
            hostCapability,
            body: { action: 'resume' },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/challenge-rounds/${firstRound.id}/timer`, {
            method: 'POST',
            hostCapability,
            body: { action: 'reset' },
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/challenge-rounds/${firstRound.id}/timer`, {
            method: 'POST',
            hostCapability,
            body: { action: 'finish' },
          })
        ).status,
      ).toBe(200);

      const samePlayerPair = await Promise.all([
        draw(firstParticipant.id),
        draw(firstParticipant.id),
      ]);
      expect(samePlayerPair.map(({ status }) => status).sort()).toEqual([201, 409]);
      const concurrentRound = samePlayerPair.find(({ body }) => body.challengeRound)?.body
        .challengeRound;
      if (!concurrentRound) throw new Error('Concurrent player draw did not return a round.');
      seen.add(concurrentRound.challenge.id);
      await invoke(
        `game-nights/${spectatorCode}/challenge-rounds/${concurrentRound.id}/timer`,
        { method: 'POST', hostCapability, body: { action: 'finish' } },
      );
      let exhausted = false;
      for (let count = 0; count < 30 && !exhausted; count += 1) {
        const participant = count % 2 === 0 ? firstParticipant : secondParticipant;
        const result = await draw(participant.id);
        if (result.body.error?.code === 'NO_UNUSED_CHALLENGES') {
          exhausted = true;
        } else if (result.body.challengeRound) {
          expect(seen.has(result.body.challengeRound.challenge.id)).toBe(false);
          seen.add(result.body.challengeRound.challenge.id);
          await invoke(
            `game-nights/${spectatorCode}/challenge-rounds/${result.body.challengeRound.id}/timer`,
            { method: 'POST', hostCapability, body: { action: 'finish' } },
          );
        }
      }
      expect(exhausted).toBe(true);
    });
  },
);
