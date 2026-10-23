import { useState } from 'react';
import { GameNightPage } from '../features/game-night/GameNightPage';
import { HostSetup } from '../features/game-night/HostSetup';
import { LeaderboardPage } from '../features/history/LeaderboardPage';

type Page = 'home' | 'leaderboard' | 'game';

export function App() {
  const [page, setPage] = useState<Page>('home');
  const [spectatorCode, setSpectatorCode] = useState<string | null>(null);
  const [hostCapability, setHostCapability] = useState<string | null>(null);

  return (
    <div className="site-shell">
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
        </nav>
      </header>

      <main>
        {page === 'home' && !spectatorCode && (
          <HostSetup
            onCreated={(code, capability) => {
              setSpectatorCode(code);
              setHostCapability(capability);
              setPage('game');
            }}
            onJoin={(code) => {
              setSpectatorCode(code);
              setHostCapability(null);
              setPage('game');
            }}
          />
        )}
        {page === 'game' && spectatorCode && (
          <GameNightPage
            spectatorCode={spectatorCode}
            hostCapability={hostCapability}
            onLeave={() => {
              setSpectatorCode(null);
              setHostCapability(null);
              setPage('home');
            }}
          />
        )}
        {page === 'leaderboard' && <LeaderboardPage />}
      </main>
    </div>
  );
}
