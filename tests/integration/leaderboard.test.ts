import { describe, expect, it } from 'vitest';
import { createActiveGame, invoke } from './helpers';
import { integrationEnvironment } from './setup';

describe.skipIf(!integrationEnvironment.url || !integrationEnvironment.publishableKey)(
  'historical leaderboard functions',
  () => {
    it('persists completed scores and returns all tied winners', async () => {
      const { hostCapability, spectatorCode } = await createActiveGame();
      const snapshot = await invoke<{ gameNight: { participants: Array<{ id: string }> } }>(
        `game-nights/${spectatorCode}`,
      );
      for (const participant of snapshot.body.gameNight.participants) {
        await invoke(`game-nights/${spectatorCode}/participants/${participant.id}/score`, {
          method: 'POST',
          hostCapability,
          body: { delta: 500, idempotencyKey: crypto.randomUUID() },
        });
      }
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/complete`, {
            method: 'POST',
            hostCapability,
            body: {},
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await invoke(
            `game-nights/${spectatorCode}/participants/${snapshot.body.gameNight.participants[0].id}/score`,
            {
              method: 'POST',
              body: { delta: 100, idempotencyKey: crypto.randomUUID() },
            },
          )
        ).status,
      ).toBe(409);
      expect(
        (
          await invoke(`game-nights/${spectatorCode}/participants`, {
            method: 'POST',
            hostCapability,
            body: { displayName: 'Too Late' },
          })
        ).status,
      ).toBe(409);
      const completedSnapshot = await invoke<{
        gameNight: { participants: Array<{ score: number }> };
      }>(`game-nights/${spectatorCode}`);
      expect(completedSnapshot.body.gameNight.participants.map(({ score }) => score)).toEqual([
        500,
        500,
      ]);
      const history = await invoke<{
        entries: Array<{ gameNightId: string; winners: Array<{ displayName: string }> }>;
      }>('leaderboard');
      const result = history.body.entries.find(
        ({ gameNightId }) => gameNightId === snapshot.body.gameNight.id,
      );
      expect(result?.winners.map(({ displayName }) => displayName).sort()).toEqual([
        'Test Player A',
        'Test Player B',
      ]);
    });
  },
);
