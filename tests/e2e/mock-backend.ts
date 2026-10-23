import type { Page, Route } from '@playwright/test';

interface MockParticipant {
  id: string;
  gameNightId: string;
  displayName: string;
  score: number;
  teamId: string | null;
  createdAt: string;
}

interface MockRound {
  id: string;
  gameNightId: string;
  participantId: string;
  challenge: { id: string; name: string; instructions: string };
  selectedAt: string;
  finishedAt: string | null;
  timerStatus: 'ready' | 'running' | 'paused' | 'expired' | 'stopped';
  durationSeconds: number | null;
  deadlineAt: string | null;
  pausedRemainingSeconds: number | null;
}

export async function installMockBackend(page: Page) {
  let gameNight: {
    id: string;
    status: 'setup' | 'active' | 'completed';
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    participants: MockParticipant[];
    teams: MockTeam[];
    challengeRounds: MockRound[];
    availableChallengeCount: number;
    challengeCatalogAvailable: boolean;
  } | null = null;
  const challenges = [
    { id: 'challenge-1', name: 'No-HUD Run', instructions: 'Play a level with the HUD hidden.' },
    { id: 'challenge-2', name: 'Random Loadout', instructions: 'Use a random loadout.' },
    { id: 'challenge-3', name: 'One-Life Challenge', instructions: 'Play without restarting.' },
  ];
  interface MockTeam {
    id: string;
    gameNightId: string;
    name: string;
    score: number;
    createdAt: string;
  }
  const spectatorCode = '482731';
  const hostCapability = 'a'.repeat(64);

  await page.route('http://127.0.0.1:54321/functions/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const operationPath = url.pathname.replace('/functions/v1/', '');
    const segments = operationPath.split('/').filter(Boolean);
    const method = request.method();
    const send = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (method === 'GET' && segments[0] === 'leaderboard') {
      const entries =
        gameNight?.status === 'completed'
          ? [
              {
                gameNightId: gameNight.id,
                date: gameNight.completedAt ?? gameNight.createdAt,
                participants: gameNight.participants,
                winners: winners(gameNight.participants),
              },
            ]
          : [];
      return send({ entries });
    }

    if (segments[0] === 'game-nights' && segments.length === 1 && method === 'POST') {
      gameNight = {
        id: 'night-1',
        status: 'setup',
        createdAt: new Date().toISOString(),
        startedAt: null,
        completedAt: null,
        participants: [],
        teams: [],
        challengeRounds: [],
        availableChallengeCount: challenges.length,
        challengeCatalogAvailable: true,
      };
      return send(
        {
          gameNight: { id: gameNight.id, status: 'setup', createdAt: gameNight.createdAt },
          hostCapability,
          spectatorCode,
        },
        201,
      );
    }

    if (segments[0] !== 'game-nights' || segments[1] !== spectatorCode || !gameNight) {
      return send({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
    }

    if (method === 'GET' && segments.length === 2) return send({ gameNight });

    if (method === 'POST' && segments[2] === 'host-session') {
      if (request.headers().authorization !== `Bearer ${hostCapability}`) {
        return send(
          { error: { code: 'UNAUTHORIZED', message: 'Host authorization is invalid.' } },
          401,
        );
      }
      return send({ authorized: true });
    }

    if (method === 'POST' && segments[2] === 'participants' && segments.length === 3) {
      const { displayName } = request.postDataJSON() as { displayName: string };
      const participant = {
        id: `player-${gameNight.participants.length + 1}`,
        gameNightId: gameNight.id,
        displayName,
        score: 0,
        teamId: null,
        createdAt: new Date().toISOString(),
      };
      gameNight.participants.push(participant);
      return send({ participant }, 201);
    }

    if (method === 'POST' && segments[2] === 'start') {
      gameNight.status = 'active';
      gameNight.startedAt = new Date().toISOString();
      return send({ gameNight });
    }

    if (method === 'POST' && segments[2] === 'teams' && segments[3] === 'randomize') {
      const shuffled = [...gameNight.participants].sort(() => Math.random() - 0.5);
      shuffled.forEach((participant, index) => {
        participant.teamId = gameNight?.teams[index % gameNight.teams.length]?.id ?? null;
      });
      for (const team of gameNight.teams) {
        team.score = gameNight.participants
          .filter(({ teamId }) => teamId === team.id)
          .reduce((total, player) => total + player.score, 0);
      }
      return send({ updatedCount: shuffled.length });
    }
    if (method === 'POST' && segments[2] === 'teams' && segments[3] === 'generate') {
      const { mode, count } = request.postDataJSON() as {
        mode: 'team_count' | 'players_per_team';
        count: number;
      };
      const teamCount =
        mode === 'team_count' ? count : Math.ceil(gameNight.participants.length / count);
      const generatedNames = [
        'Aurora Voyagers',
        'Nebula Navigators',
        'Comet Pioneers',
        'Lunar Guardians',
        'Nova Rangers',
        'Orbit Explorers',
      ];
      gameNight.participants.forEach((participant) => {
        participant.teamId = null;
      });
      gameNight.teams = Array.from({ length: teamCount }, (_, index) => ({
        id: `generated-team-${index + 1}`,
        gameNightId: gameNight!.id,
        name: generatedNames[index % generatedNames.length],
        score: 0,
        createdAt: new Date().toISOString(),
      }));
      const shuffled = [...gameNight.participants].sort(() => Math.random() - 0.5);
      shuffled.forEach((participant, index) => {
        participant.teamId = gameNight?.teams[index % teamCount]?.id ?? null;
      });
      for (const team of gameNight.teams) {
        team.score = gameNight.participants
          .filter(({ teamId }) => teamId === team.id)
          .reduce((total, player) => total + player.score, 0);
      }
      return send({ teamCount, updatedCount: shuffled.length });
    }
    if (method === 'POST' && segments[2] === 'teams' && segments.length === 3) {
      const { name } = request.postDataJSON() as { name: string };
      const team = {
        id: `team-${gameNight.teams.length + 1}`,
        gameNightId: gameNight.id,
        name,
        score: 0,
        createdAt: new Date().toISOString(),
      };
      gameNight.teams.push(team);
      return send({ team }, 201);
    }
    if (method === 'POST' && segments[2] === 'teams' && segments[4] === 'delete') {
      const teamId = segments[3];
      gameNight.participants.forEach((player) => {
        if (player.teamId === teamId) player.teamId = null;
      });
      gameNight.teams = gameNight.teams.filter(({ id }) => id !== teamId);
      return send({ deleted: true });
    }
    if (method === 'POST' && segments[2] === 'teams' && segments[3]) {
      const team = gameNight.teams.find(({ id }) => id === segments[3]);
      if (!team) return send({ error: { code: 'NOT_FOUND', message: 'Team not found' } }, 404);
      const { name } = request.postDataJSON() as { name: string };
      team.name = name;
      return send({ team });
    }
    if (method === 'POST' && segments[2] === 'participants' && segments[4] === 'team') {
      const participant = gameNight.participants.find(({ id }) => id === segments[3]);
      const { teamId } = request.postDataJSON() as { teamId: string | null };
      if (!participant)
        return send({ error: { code: 'NOT_FOUND', message: 'Player not found' } }, 404);
      participant.teamId = teamId;
      for (const team of gameNight.teams) {
        team.score = gameNight.participants
          .filter(({ teamId: assignedTeamId }) => assignedTeamId === team.id)
          .reduce((total, player) => total + player.score, 0);
      }
      return send({ participant });
    }

    if (method === 'POST' && segments[2] === 'participants' && segments[4] === 'score') {
      const participant = gameNight.participants.find(({ id }) => id === segments[3]);
      const { delta } = request.postDataJSON() as { delta: number };
      if (!participant)
        return send({ error: { code: 'NOT_FOUND', message: 'Player not found' } }, 404);
      participant.score += delta;
      for (const team of gameNight.teams) {
        team.score = gameNight.participants
          .filter(({ teamId }) => teamId === team.id)
          .reduce((total, player) => total + player.score, 0);
      }
      return send({ participant });
    }

    if (method === 'POST' && segments[2] === 'challenge-draws') {
      const { participantId } = request.postDataJSON() as { participantId: string };
      if (
        gameNight.challengeRounds.some(
          (round) => round.participantId === participantId && !round.finishedAt,
        )
      )
        return send(
          { error: { code: 'ROUND_ALREADY_ACTIVE', message: 'Finish the current round first' } },
          409,
        );
      const used = new Set(gameNight.challengeRounds.map(({ challenge }) => challenge.id));
      const next = challenges.find(({ id }) => !used.has(id));
      if (!next)
        return send(
          { error: { code: 'NO_UNUSED_CHALLENGES', message: 'No challenges left' } },
          409,
        );
      const challengeRound: MockRound = {
        id: `round-${gameNight.challengeRounds.length + 1}`,
        gameNightId: gameNight.id,
        participantId,
        challenge: next,
        selectedAt: new Date().toISOString(),
        finishedAt: null,
        timerStatus: 'ready',
        durationSeconds: null,
        deadlineAt: null,
        pausedRemainingSeconds: null,
      };
      gameNight.challengeRounds.push(challengeRound);
      return send({ challengeRound }, 201);
    }

    if (method === 'POST' && segments[2] === 'challenge-rounds' && segments[4] === 'timer') {
      const round = gameNight.challengeRounds.find(({ id }) => id === segments[3]);
      const { action, durationSeconds } = request.postDataJSON() as {
        action: 'start' | 'pause' | 'resume' | 'reset' | 'finish';
        durationSeconds?: number;
      };
      if (!round) return send({ error: { code: 'NOT_FOUND', message: 'Round not found' } }, 404);
      if (action === 'start') {
        round.durationSeconds = durationSeconds ?? 1;
        round.deadlineAt = new Date(Date.now() + round.durationSeconds * 1000).toISOString();
        round.timerStatus = 'running';
      } else if (action === 'pause') {
        round.pausedRemainingSeconds = Math.max(
          1,
          Math.ceil((Date.parse(round.deadlineAt ?? '') - Date.now()) / 1000),
        );
        round.deadlineAt = null;
        round.timerStatus = 'paused';
      } else if (action === 'resume') {
        round.deadlineAt = new Date(
          Date.now() + (round.pausedRemainingSeconds ?? 1) * 1000,
        ).toISOString();
        round.pausedRemainingSeconds = null;
        round.timerStatus = 'running';
      } else if (action === 'finish') {
        round.timerStatus = 'stopped';
        round.deadlineAt = null;
        round.pausedRemainingSeconds = null;
        round.finishedAt = new Date().toISOString();
      } else {
        round.timerStatus = 'ready';
        round.deadlineAt = null;
        round.pausedRemainingSeconds = null;
      }
      return send({ challengeRound: round });
    }

    if (method === 'POST' && segments[2] === 'complete') {
      gameNight.status = 'completed';
      gameNight.completedAt = new Date().toISOString();
      return send({ gameNight });
    }

    return send({ error: { code: 'NOT_FOUND', message: 'Not found' } }, 404);
  });
}

function winners(participants: MockParticipant[]) {
  const max = Math.max(...participants.map(({ score }) => score));
  return participants
    .filter(({ score }) => score === max)
    .map(({ displayName, score }) => ({ displayName, score }));
}
