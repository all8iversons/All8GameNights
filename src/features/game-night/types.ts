export type GameNightStatus = 'setup' | 'active' | 'completed';

export type TimerStatus = 'ready' | 'running' | 'paused' | 'expired' | 'stopped';

export interface Participant {
  id: string;
  gameNightId: string;
  displayName: string;
  score: number;
  teamId: string | null;
  createdAt: string;
}

export interface Team {
  id: string;
  gameNightId: string;
  name: string;
  score: number;
  createdAt: string;
}

export interface Challenge {
  id: string;
  name: string;
  instructions: string;
  enabled: boolean;
}

export interface ChallengeRound {
  id: string;
  gameNightId: string;
  participantId: string;
  challenge: Challenge;
  selectedAt: string;
  finishedAt: string | null;
  timerStatus: TimerStatus;
  durationSeconds: number | null;
  deadlineAt: string | null;
  pausedRemainingSeconds: number | null;
}

export interface GameNight {
  id: string;
  status: GameNightStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  participants: Participant[];
  teams: Team[];
  challengeRounds: ChallengeRound[];
  availableChallengeCount: number;
  unusedChallengeCount: number;
  challengeCatalogAvailable: boolean;
  winners?: Winner[];
}

export interface Winner {
  displayName: string;
  score: number;
}

export interface LeaderboardEntry {
  gameNightId: string;
  date: string;
  participants: Participant[];
  winners: Winner[];
}
