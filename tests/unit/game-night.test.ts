import { describe, expect, it } from 'vitest';
import { rankParticipants } from '../../src/features/game-night/leaderboard-rank';
import type { Participant } from '../../src/features/game-night/types';

const player = (id: string, score: number): Participant => ({
  id,
  gameNightId: 'night',
  displayName: id,
  score,
  teamId: null,
  createdAt: '',
});

describe('rankParticipants', () => {
  it('ranks high scores first and assigns equal ranks to ties', () => {
    expect(
      rankParticipants([player('A', 100), player('B', 200), player('C', 200)]).map(
        ({ rank }) => rank,
      ),
    ).toEqual([1, 1, 3]);
  });
});
