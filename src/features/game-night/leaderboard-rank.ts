import type { Participant } from './types';

export function rankParticipants(participants: Participant[]) {
  const sorted = [...participants].sort((left, right) => right.score - left.score);
  let currentRank = 0;
  let previousScore: number | null = null;
  return sorted.map((participant, index) => {
    if (participant.score !== previousScore) currentRank = index + 1;
    previousScore = participant.score;
    return { ...participant, rank: currentRank };
  });
}
