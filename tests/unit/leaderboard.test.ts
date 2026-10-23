import { describe, expect, it } from 'vitest';
import {
  deriveWinners,
  sortLeaderboardEntries,
} from '../../src/features/history/leaderboard-utils';

describe('historical leaderboard results', () => {
  it('orders events newest first and includes all highest-score ties', () => {
    const oldNight = { gameNightId: 'old', date: '2026-01-01', participants: [], winners: [] };
    const newNight = { gameNightId: 'new', date: '2026-02-01', participants: [], winners: [] };
    expect(
      sortLeaderboardEntries([oldNight, newNight]).map(({ gameNightId }) => gameNightId),
    ).toEqual(['new', 'old']);
    expect(
      deriveWinners([
        { displayName: 'A', score: 10 },
        { displayName: 'B', score: 10 },
        { displayName: 'C', score: 9 },
      ]).map(({ displayName }) => displayName),
    ).toEqual(['A', 'B']);
  });
});
