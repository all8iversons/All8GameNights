import { describe, expect, it } from 'vitest';
import { createActiveGame, invoke } from './helpers';
import { integrationEnvironment } from './setup';

describe.skipIf(!integrationEnvironment.url || !integrationEnvironment.publishableKey)(
  'challenge functions',
  () => {
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
