import { afterEach, describe, expect, it } from 'vitest';
import { clearHostSession, loadHostSession, saveHostSession } from '../../src/lib/host-session';

afterEach(() => {
  clearHostSession();
});

describe('host session storage', () => {
  it('saves and loads a valid room code and private host recovery key', () => {
    const session = { spectatorCode: '482731', hostCapability: 'a'.repeat(64) };

    expect(saveHostSession(session)).toBe(true);
    expect(loadHostSession()).toEqual(session);
  });

  it('clears a stored host session when leaving the board', () => {
    saveHostSession({ spectatorCode: '482731', hostCapability: 'a'.repeat(64) });

    expect(clearHostSession()).toBe(true);
    expect(loadHostSession()).toBeNull();
  });

  it('rejects malformed stored values', () => {
    sessionStorage.setItem(
      'game-night-host-session',
      JSON.stringify({ spectatorCode: '482731', hostCapability: 'not-a-key' }),
    );

    expect(loadHostSession()).toBeNull();
  });
});
