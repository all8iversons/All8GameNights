import { useEffect, useRef, useState } from 'react';
import { ApiRequestError } from '../lib/api-client';
import { clearHostSession, loadHostSession, saveHostSession } from '../lib/host-session';
import { LoadingState } from '../components/Feedback';
import { GameNightPage } from '../features/game-night/GameNightPage';
import { HostSetup } from '../features/game-night/HostSetup';
import { gameNightApi } from '../features/game-night/game-night-api';
import { LeaderboardPage } from '../features/history/LeaderboardPage';
import { GlobalContentAdminPage } from '../features/admin/GlobalContentAdminPage';

type Page = 'home' | 'leaderboard' | 'game' | 'admin';

export function App() {
  const displayCodeAtLoad = useRef(new URLSearchParams(window.location.search).get('display'));
  const [page, setPage] = useState<Page>(() =>
    displayCodeAtLoad.current ? 'game' : 'home',
  );
  const [spectatorCode, setSpectatorCode] = useState<string | null>(
    () => displayCodeAtLoad.current,
  );
  const [hostCapability, setHostCapability] = useState<string | null>(null);
  const [displayOnly, setDisplayOnly] = useState(() => Boolean(displayCodeAtLoad.current));
  const [restoringHostSession, setRestoringHostSession] = useState(() =>
    !displayCodeAtLoad.current && Boolean(loadHostSession()),
  );
  const [homeError, setHomeError] = useState('');
  const [sessionWarning, setSessionWarning] = useState('');

  useEffect(() => {
    if (displayCodeAtLoad.current) {
      setRestoringHostSession(false);
      return;
    }
    const savedSession = loadHostSession();
    if (!savedSession) {
      setRestoringHostSession(false);
      return;
    }

    let active = true;
    void gameNightApi
      .reconnectHost(savedSession.spectatorCode, savedSession.hostCapability)
      .then(() => {
        if (!active) return;
        setSpectatorCode(savedSession.spectatorCode);
        setHostCapability(savedSession.hostCapability);
        setPage('game');
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiRequestError && [401, 404].includes(cause.status)) {
          clearHostSession();
        }
        setHomeError(
          cause instanceof Error
            ? `Could not restore the saved host session: ${cause.message}`
            : 'Could not restore the saved host session.',
        );
      })
      .finally(() => {
        if (active) setRestoringHostSession(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function enterHostSession(code: string, capability: string) {
    setHomeError('');
    setSessionWarning(
      saveHostSession({ spectatorCode: code, hostCapability: capability })
        ? ''
        : 'This browser could not save your host session. Keep the host recovery key shown on the board to reconnect later.',
    );
    setSpectatorCode(code);
    setHostCapability(capability);
    setDisplayOnly(false);
    setPage('game');
  }

  return (
    <div className="site-shell">
      {!displayOnly && (
        <header className="topbar">
          <button className="brand" onClick={() => setPage(spectatorCode ? 'game' : 'home')}>
            <span className="brand-mark" aria-hidden="true">
              ★
            </span>
            <span>
              Game Night <strong>Showdown</strong>
            </span>
          </button>
          <nav aria-label="Main navigation">
            <button
              className={page === 'home' || page === 'game' ? 'nav-link active' : 'nav-link'}
              onClick={() => setPage(spectatorCode ? 'game' : 'home')}
            >
              Play
            </button>
            <button
              className={page === 'leaderboard' ? 'nav-link active' : 'nav-link'}
              onClick={() => setPage('leaderboard')}
            >
              Hall of Fame
            </button>
            <button
              className={page === 'admin' ? 'nav-link active' : 'nav-link'}
              onClick={() => setPage('admin')}
            >
              Manage content
            </button>
          </nav>
        </header>
      )}

      <main>
        {restoringHostSession && <LoadingState message="Restoring host session…" />}
        {page === 'home' && !spectatorCode && !restoringHostSession && (
          <HostSetup
            initialError={homeError}
            onCreated={enterHostSession}
            onJoin={(code, display) => {
              if (!display) clearHostSession();
              setSessionWarning('');
              setSpectatorCode(code);
              setHostCapability(null);
              setDisplayOnly(display);
              setPage('game');
            }}
            onReconnect={enterHostSession}
          />
        )}
        {page === 'game' && spectatorCode && (
          <GameNightPage
            spectatorCode={spectatorCode}
            hostCapability={hostCapability}
            displayOnly={displayOnly}
            sessionWarning={sessionWarning}
            onLeave={() => {
              if (!displayOnly) clearHostSession();
              setSpectatorCode(null);
              setHostCapability(null);
              setDisplayOnly(false);
              setSessionWarning('');
              if (displayOnly) {
                window.history.replaceState({}, '', window.location.pathname);
              }
              setPage('home');
            }}
          />
        )}
        {page === 'leaderboard' && <LeaderboardPage />}
        {page === 'admin' && <GlobalContentAdminPage />}
      </main>
    </div>
  );
}
