import { apiRequest } from '../../lib/api-client';
import { createIdempotencyKey } from '../../lib/idempotency-key';
import type {
  Challenge,
  GameNight,
  LeaderboardEntry,
  Participant,
  ChallengeRound,
  Team,
} from './types';
import type { CreatedGameNightResponse } from '../../lib/api-types';

export const gameNightApi = {
  create: () => apiRequest<CreatedGameNightResponse>('game-nights', { method: 'POST', body: {} }),

  snapshot: (spectatorCode: string) =>
    apiRequest<{ gameNight: GameNight }>(`game-nights/${spectatorCode}`),

  reconnectHost: (spectatorCode: string, hostCapability: string) =>
    apiRequest<{ authorized: true }>(`game-nights/${spectatorCode}/host-session`, {
      method: 'POST',
      hostCapability,
      body: {},
    }),

  addParticipant: (spectatorCode: string, hostCapability: string, displayName: string) =>
    apiRequest<{ participant: Participant }>(`game-nights/${spectatorCode}/participants`, {
      method: 'POST',
      hostCapability,
      body: { displayName },
    }),

  removeParticipant: (spectatorCode: string, hostCapability: string, participantId: string) =>
    apiRequest<{ removed: true }>(
      `game-nights/${spectatorCode}/participants/${participantId}/remove`,
      {
        method: 'POST',
        hostCapability,
        body: {},
      },
    ),

  renameParticipant: (
    spectatorCode: string,
    hostCapability: string,
    participantId: string,
    displayName: string,
  ) =>
    apiRequest<{ participant: Participant }>(
      `game-nights/${spectatorCode}/participants/${participantId}/rename`,
      {
        method: 'POST',
        hostCapability,
        body: { displayName },
      },
    ),

  challengeCatalog: (spectatorCode: string, hostCapability: string) =>
    apiRequest<{ challenges: Challenge[] }>(`game-nights/${spectatorCode}/challenges`, {
      hostCapability,
    }),

  adminChallengeCatalog: (adminPassword: string) =>
    apiRequest<{ challenges: Challenge[] }>('game-nights/admin/challenges', {
      adminPassword,
    }),

  adminCreateChallenge: (
    adminPassword: string,
    challenge: Pick<Challenge, 'name' | 'instructions'>,
  ) =>
    apiRequest<{ challenge: Challenge }>('game-nights/admin/challenges', {
      method: 'POST',
      adminPassword,
      body: challenge,
    }),

  adminUpdateChallenge: (
    adminPassword: string,
    challengeId: string,
    challenge: Pick<Challenge, 'name' | 'instructions' | 'enabled'>,
  ) =>
    apiRequest<{ challenge: Challenge }>(`game-nights/admin/challenges/${challengeId}`, {
      method: 'POST',
      adminPassword,
      body: challenge,
    }),

  adminArchiveChallenge: (adminPassword: string, challengeId: string) =>
    apiRequest<{ challenge: Challenge }>(
      `game-nights/admin/challenges/${challengeId}/archive`,
      {
        method: 'POST',
        adminPassword,
        body: {},
      },
    ),

  adminTeamNames: (adminPassword: string) =>
    apiRequest<{ teamNames: Array<{ id: string; name: string; createdAt: string }> }>(
      'game-nights/admin/team-names',
      { adminPassword },
    ),

  adminCreateTeamName: (adminPassword: string, name: string) =>
    apiRequest<{ teamName: { id: string; name: string; createdAt: string } }>(
      'game-nights/admin/team-names',
      {
        method: 'POST',
        adminPassword,
        body: { name },
      },
    ),

  adminUpdateTeamName: (adminPassword: string, id: string, name: string) =>
    apiRequest<{ teamName: { id: string; name: string; createdAt: string } }>(
      `game-nights/admin/team-names/${id}`,
      {
        method: 'POST',
        adminPassword,
        body: { name },
      },
    ),

  adminRemoveTeamName: (adminPassword: string, id: string) =>
    apiRequest<{ removed: true }>(`game-nights/admin/team-names/${id}/remove`, {
      method: 'POST',
      adminPassword,
      body: {},
    }),

  createChallenge: (
    spectatorCode: string,
    hostCapability: string,
    challenge: Pick<Challenge, 'name' | 'instructions' | 'enabled'>,
  ) =>
    apiRequest<{ challenge: Challenge }>(`game-nights/${spectatorCode}/challenges`, {
      method: 'POST',
      hostCapability,
      body: challenge,
    }),

  updateChallenge: (
    spectatorCode: string,
    hostCapability: string,
    challengeId: string,
    challenge: Pick<Challenge, 'name' | 'instructions' | 'enabled'>,
  ) =>
    apiRequest<{ challenge: Challenge }>(
      `game-nights/${spectatorCode}/challenges/${challengeId}`,
      {
        method: 'POST',
        hostCapability,
        body: challenge,
      },
    ),

  createTeam: (spectatorCode: string, hostCapability: string, name: string) =>
    apiRequest<{ team: Team }>(`game-nights/${spectatorCode}/teams`, {
      method: 'POST',
      hostCapability,
      body: { name },
    }),

  randomizeTeams: (spectatorCode: string, hostCapability: string) =>
    apiRequest<{ updatedCount: number }>(`game-nights/${spectatorCode}/teams/randomize`, {
      method: 'POST',
      hostCapability,
      body: {},
    }),

  generateTeams: (
    spectatorCode: string,
    hostCapability: string,
    mode: 'team_count' | 'players_per_team',
    count: number,
  ) =>
    apiRequest<{ teamCount: number; updatedCount: number }>(
      `game-nights/${spectatorCode}/teams/generate`,
      {
        method: 'POST',
        hostCapability,
        body: { mode, count },
      },
    ),

  renameTeam: (spectatorCode: string, hostCapability: string, teamId: string, name: string) =>
    apiRequest<{ team: Team }>(`game-nights/${spectatorCode}/teams/${teamId}`, {
      method: 'POST',
      hostCapability,
      body: { name },
    }),

  deleteTeam: (spectatorCode: string, hostCapability: string, teamId: string) =>
    apiRequest<{ deleted: boolean }>(`game-nights/${spectatorCode}/teams/${teamId}/delete`, {
      method: 'POST',
      hostCapability,
      body: {},
    }),

  assignTeam: (
    spectatorCode: string,
    hostCapability: string,
    participantId: string,
    teamId: string | null,
  ) =>
    apiRequest<{ participant: Participant }>(
      `game-nights/${spectatorCode}/participants/${participantId}/team`,
      {
        method: 'POST',
        hostCapability,
        body: { teamId },
      },
    ),

  start: (spectatorCode: string, hostCapability: string) =>
    apiRequest<{ gameNight: GameNight }>(`game-nights/${spectatorCode}/start`, {
      method: 'POST',
      hostCapability,
      body: {},
    }),

  updateScore: (spectatorCode: string, participantId: string, delta: number) =>
    apiRequest<{ participant: Participant }>(
      `game-nights/${spectatorCode}/participants/${participantId}/score`,
      {
        method: 'POST',
        body: { delta, idempotencyKey: createIdempotencyKey() },
      },
    ),

  drawChallenge: (spectatorCode: string, hostCapability: string, participantId: string) =>
    apiRequest<{ challengeRound: ChallengeRound }>(`game-nights/${spectatorCode}/challenge-draws`, {
      method: 'POST',
      hostCapability,
      body: { participantId, idempotencyKey: createIdempotencyKey() },
    }),

  tradeChallenges: (
    spectatorCode: string,
    firstParticipantId: string,
    secondParticipantId: string,
  ) =>
    apiRequest<{ traded: true }>(`game-nights/${spectatorCode}/challenge-trades`, {
      method: 'POST',
      body: {
        firstParticipantId,
        secondParticipantId,
        idempotencyKey: createIdempotencyKey(),
      },
    }),

  timer: (
    spectatorCode: string,
    hostCapability: string,
    roundId: string,
    action: 'start' | 'pause' | 'resume' | 'reset' | 'finish',
    durationSeconds?: number,
  ) =>
    apiRequest<{ challengeRound: ChallengeRound }>(
      `game-nights/${spectatorCode}/challenge-rounds/${roundId}/timer`,
      {
        method: 'POST',
        hostCapability,
        body: { action, durationSeconds },
      },
    ),

  undoFinishChallenge: (spectatorCode: string, hostCapability: string, roundId: string) =>
    apiRequest<{ challengeRound: ChallengeRound }>(
      `game-nights/${spectatorCode}/challenge-rounds/${roundId}/undo-finish`,
      {
        method: 'POST',
        hostCapability,
        body: {},
      },
    ),

  complete: (spectatorCode: string, hostCapability: string) =>
    apiRequest<{ gameNight: GameNight }>(`game-nights/${spectatorCode}/complete`, {
      method: 'POST',
      hostCapability,
      body: {},
    }),

  leaderboard: () => apiRequest<{ entries: LeaderboardEntry[] }>('leaderboard'),
};
