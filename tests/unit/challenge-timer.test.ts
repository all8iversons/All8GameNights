import { describe, expect, it } from 'vitest';
import {
  formatTime,
  isValidTimerDuration,
  secondsRemaining,
} from '../../src/features/timer/timer-utils';

describe('challenge timer countdown', () => {
  it('derives remaining seconds from the authoritative deadline', () => {
    expect(
      secondsRemaining('2026-10-22T12:00:10.000Z', Date.parse('2026-10-22T12:00:05.000Z')),
    ).toBe(5);
    expect(
      secondsRemaining('2026-10-22T12:00:10.000Z', Date.parse('2026-10-22T12:00:11.000Z')),
    ).toBe(0);
  });

  it('accepts only positive whole-second durations and formats expiration at zero', () => {
    expect(isValidTimerDuration(1)).toBe(true);
    expect(isValidTimerDuration(0)).toBe(false);
    expect(isValidTimerDuration(-1)).toBe(false);
    expect(isValidTimerDuration(1.5)).toBe(false);
    expect(formatTime(0)).toBe('0:00');
  });
});
