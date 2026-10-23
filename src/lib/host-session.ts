const hostSessionStorageKey = 'game-night-host-session';

export interface HostSession {
  spectatorCode: string;
  hostCapability: string;
}

export function loadHostSession(): HostSession | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(hostSessionStorageKey) ?? 'null');
    if (
      typeof value !== 'object' ||
      value === null ||
      !('spectatorCode' in value) ||
      !('hostCapability' in value) ||
      typeof value.spectatorCode !== 'string' ||
      !/^\d{6}$/.test(value.spectatorCode) ||
      typeof value.hostCapability !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(value.hostCapability)
    ) {
      return null;
    }

    return {
      spectatorCode: value.spectatorCode,
      hostCapability: value.hostCapability,
    };
  } catch {
    return null;
  }
}

export function saveHostSession(session: HostSession): boolean {
  try {
    sessionStorage.setItem(hostSessionStorageKey, JSON.stringify(session));
    return true;
  } catch {
    return false;
  }
}

export function clearHostSession(): boolean {
  try {
    sessionStorage.removeItem(hostSessionStorageKey);
    return true;
  } catch {
    return false;
  }
}
