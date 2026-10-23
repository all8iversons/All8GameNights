import { describe, expect, it } from 'vitest';
import { createActiveGame, invoke } from './helpers';
import { integrationEnvironment } from './setup';

describe.skipIf(!integrationEnvironment.url || !integrationEnvironment.publishableKey)(
  'global content management',
  () => {
    it.skipIf(!integrationEnvironment.adminPassword)(
      'requires the admin password and manages challenges and the random team-name pool without a game night',
      async () => {
        const password = integrationEnvironment.adminPassword;
        const auth = { headers: { authorization: `Bearer ${password}` } };
        const unauthorized = await invoke('game-nights/admin/challenges');
        expect(unauthorized.status).toBe(401);

        const initial = await invoke<{
          challenges: Array<{ id: string; name: string; instructions: string; enabled: boolean }>;
        }>('game-nights/admin/challenges', auth);
        expect(initial.status).toBe(200);
        expect(initial.body.challenges.length).toBeGreaterThan(0);

        const unique = crypto.randomUUID();
        const createdChallenge = await invoke<{
          challenge: { id: string; enabled: boolean };
        }>('game-nights/admin/challenges', {
          ...auth,
          method: 'POST',
          body: { name: `Admin integration ${unique}`, instructions: 'A global challenge.' },
        });
        expect(createdChallenge.status).toBe(201);

        const archived = await invoke<{
          challenge: { id: string; enabled: boolean };
        }>(`game-nights/admin/challenges/${createdChallenge.body.challenge.id}/archive`, {
          ...auth,
          method: 'POST',
          body: {},
        });
        expect(archived.status).toBe(200);
        expect(archived.body.challenge).toMatchObject({
          id: createdChallenge.body.challenge.id,
          enabled: false,
        });

        const createdName = await invoke<{
          teamName: { id: string; name: string };
        }>('game-nights/admin/team-names', {
          ...auth,
          method: 'POST',
          body: { name: `Admin Team ${unique}` },
        });
        expect(createdName.status).toBe(201);
        const updatedName = await invoke<{
          teamName: { id: string; name: string };
        }>(`game-nights/admin/team-names/${createdName.body.teamName.id}`, {
          ...auth,
          method: 'POST',
          body: { name: `Renamed Admin Team ${unique}` },
        });
        expect(updatedName.status).toBe(200);
        expect(updatedName.body.teamName.name).toBe(`Renamed Admin Team ${unique}`);

        const removedName = await invoke<{ removed: boolean }>(
          `game-nights/admin/team-names/${createdName.body.teamName.id}/remove`,
          { ...auth, method: 'POST', body: {} },
        );
        expect(removedName.status).toBe(200);
        expect(removedName.body.removed).toBe(true);
      },
    );

    it.skipIf(!integrationEnvironment.adminPassword)(
      'uses the managed team-name pool when generating teams for a game',
      async () => {
        const { hostCapability, spectatorCode } = await createActiveGame();
        const password = integrationEnvironment.adminPassword;
        const { body: pool } = await invoke<{
          teamNames: Array<{ name: string }>;
        }>('game-nights/admin/team-names', {
          headers: { authorization: `Bearer ${password}` },
        });

        const generated = await invoke<{ teamCount: number }>(
          `game-nights/${spectatorCode}/teams/generate`,
          {
            method: 'POST',
            hostCapability,
            body: { mode: 'team_count', count: 2 },
          },
        );
        expect(generated.status).toBe(200);
        const snapshot = await invoke<{
          gameNight: { teams: Array<{ name: string }> };
        }>(`game-nights/${spectatorCode}`);
        expect(snapshot.body.gameNight.teams).toHaveLength(2);
        expect(snapshot.body.gameNight.teams.every(({ name }) => pool.teamNames.some((item) => item.name === name))).toBe(true);
      },
    );
  },
);
