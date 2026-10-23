import type { LeaderboardEntry, Participant, Winner } from '../game-night/types';

export function sortLeaderboardEntries(entries: LeaderboardEntry[]) {
  return [...entries].sort((left, right) => right.date.localeCompare(left.date));
}

export function deriveWinners(
  participants: Pick<Participant, 'displayName' | 'score'>[],
): Winner[] {
  if (participants.length === 0) return [];
  const topScore = Math.max(...participants.map(({ score }) => score));
  return participants
    .filter(({ score }) => score === topScore)
    .map(({ displayName, score }) => ({ displayName, score }));
}
