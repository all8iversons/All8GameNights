import { expect, test } from '@playwright/test';
import { installMockBackend } from './mock-backend';

test('challenge draws are unique and timer controls work', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  await page.getByLabel(/player name/i).fill('Player A');
  await page.getByRole('button', { name: /add player/i }).click();
  await page.getByLabel(/player name/i).fill('Player B');
  await page.getByRole('button', { name: /add player/i }).click();
  await page.getByRole('button', { name: /start game night/i }).click();
  await page.getByRole('button', { name: /draw a challenge/i }).first().click();
  await page.getByRole('button', { name: /draw a challenge/i }).first().click();
  await expect(page.getByRole('heading', { name: /no-hud run/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /random loadout/i })).toBeVisible();
  const playerACard = page.locator('.challenge-card').filter({
    has: page.getByRole('heading', { name: "Player A's challenge" }),
  });
  await expect(playerACard.getByRole('timer')).toBeVisible();
  await expect(playerACard.getByRole('button', { name: 'Start' })).toBeVisible();
  await page.getByLabel(/timer duration for player a/i).fill('5');
  await page.getByRole('button', { name: /^start$/i }).first().click();
  await page.getByLabel(/timer duration for player b/i).fill('8');
  await page.getByRole('button', { name: /^start$/i }).first().click();
  await expect(page.getByText(/timer running/i)).toHaveCount(2);
  await page.getByRole('button', { name: /pause/i }).first().click();
  await expect(page.getByText(/timer paused/i)).toHaveCount(1);
  await expect(page.getByText(/timer running/i)).toHaveCount(1);
  await page.getByRole('button', { name: /resume/i }).first().click();
  await expect(page.getByText(/timer running/i)).toHaveCount(2);
  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('button', { name: /issue new challenge/i }).first().click();
  await expect(page.getByRole('heading', { name: /no-hud run/i })).toBeVisible();
  await expect(page.getByText(/timer running/i)).toHaveCount(2);
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: /issue new challenge/i }).first().click();
  await expect(page.getByRole('heading', { name: /random loadout/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /one-life challenge/i })).toBeVisible();
  await expect(page.getByText(/timer running/i)).toHaveCount(1);
});

test('teammates can trade unfinished challenges but not while a timer is running', async ({
  page,
}) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  for (const name of ['Player A', 'Player B']) {
    await page.getByLabel(/player name/i).fill(name);
    await page.getByRole('button', { name: /add player/i }).click();
  }
  await page.getByLabel(/team name/i).fill('Team One');
  await page.getByRole('button', { name: /add team/i }).click();
  await page.getByLabel('Team setup method').selectOption('team_count');
  await page.getByLabel('Number of teams').fill('1');
  await page.getByRole('button', { name: /generate random teams/i }).click();
  await page.getByRole('button', { name: /start game night/i }).click();
  await page.getByRole('button', { name: /draw a challenge/i }).first().click();
  await page.getByRole('button', { name: /draw a challenge/i }).first().click();

  const playerA = page.locator('.challenge-card').filter({
    has: page.getByRole('heading', { name: "Player A's challenge" }),
  });
  const playerB = page.locator('.challenge-card').filter({
    has: page.getByRole('heading', { name: "Player B's challenge" }),
  });
  await expect(playerA.getByRole('heading', { name: /no-hud run/i })).toBeVisible();
  await expect(playerB.getByRole('heading', { name: /random loadout/i })).toBeVisible();
  await page.getByRole('button', { name: 'Wide-screen view' }).click();
  await expect(page.locator('.game-night-page')).toHaveClass(/wide-screen-mode/);
  await expect(page.getByRole('heading', { name: 'Team standings' })).toBeVisible();
  await expect(
    page.locator('.scoreboard section[aria-labelledby="team-standings-heading"]'),
  ).toContainText('Aurora Voyagers');
  await expect(playerA.getByRole('timer')).toBeVisible();
  await expect(playerA.getByText('Aurora Voyagers')).toBeVisible();
  await expect(playerA.getByLabel('100 points')).toBeVisible();
  await expect(playerA.getByText('Bonus round')).toHaveCount(0);
  await expect(
    page.getByText('That’s the full deck—every challenge has been played tonight.'),
  ).toHaveCount(0);
  await expect(page.getByText('Ready when you are')).toHaveCount(0);
  await expect(playerA.getByRole('button', { name: /issue new challenge/i })).toHaveCount(0);
  await expect(playerA.getByLabel('Trade challenge with a teammate')).toHaveCount(0);
  await expect(
    playerA.getByRole('button', { name: /start|pause|resume|reset|finish challenge/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /add 100 points|subtract 100 points/i }),
  ).toHaveCount(0);
  await expect(page.locator('.wide-scoreline')).toHaveCount(0);
  const wideTimerFontSize = await playerA.getByRole('timer').evaluate(
    (timer) => window.getComputedStyle(timer).fontSize,
  );
  expect(Number.parseFloat(wideTimerFontSize)).toBeLessThanOrEqual(30);
  await page.getByRole('button', { name: 'Exit wide-screen view' }).click();
  await expect(page.locator('.game-night-page')).not.toHaveClass(/wide-screen-mode/);
  await expect(playerA.getByRole('button', { name: 'Start' })).toBeVisible();
  await expect(
    page.getByText('That’s the full deck—every challenge has been played tonight.'),
  ).toBeVisible();
  await expect(page.getByText('Ready when you are').first()).toBeVisible();

  await playerA.getByLabel('Trade challenge with a teammate').selectOption('player-2');
  await playerA.getByRole('button', { name: 'Trade challenges' }).click();
  await expect(playerA.getByRole('heading', { name: /random loadout/i })).toBeVisible();
  await expect(playerB.getByRole('heading', { name: /no-hud run/i })).toBeVisible();

  await page.getByLabel(/timer duration for player a/i).fill('30');
  await page.getByRole('button', { name: /^start$/i }).first().click();
  await expect(playerA.getByText(/pause or stop both timers before trading/i)).toBeVisible();
  await expect(playerA.getByLabel('Trade challenge with a teammate')).toHaveCount(0);
});

test('hosts can manage the shared challenge catalog and remove active players', async ({
  page,
}) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  for (const name of ['Player A', 'Player B', 'Player C']) {
    await page.getByLabel(/player name/i).fill(name);
    await page.getByRole('button', { name: /add player/i }).click();
  }
  await page.getByRole('button', { name: /start game night/i }).click();
  await page.getByRole('button', { name: /draw a challenge/i }).first().click();
  const playerB = page.locator('.challenge-card').filter({
    has: page.getByRole('heading', { name: "Player B's challenge" }),
  });
  await playerB.getByRole('button', { name: 'Draw a challenge' }).click();

  const playerA = page.locator('.challenge-card').filter({
    has: page.getByRole('heading', { name: "Player A's challenge" }),
  });
  await page.getByText('Manage shared challenge catalog').click();
  await page.getByLabel('Challenge name', { exact: true }).first().fill('Community Challenge');
  await page
    .getByLabel('Instructions', { exact: true })
    .first()
    .fill('Complete a challenge suggested by the group.');
  await page.getByRole('button', { name: 'Add challenge' }).click();

  const communityRow = page.locator('.challenge-catalog-list li').filter({
    hasText: 'Community Challenge',
  });
  await expect(communityRow).toHaveCount(1);
  await communityRow.getByLabel('Challenge name').fill('Community Challenge Updated');
  await communityRow.getByLabel('Instructions').fill('Use the updated group challenge.');
  await communityRow.getByRole('button', { name: 'Save challenge' }).click();
  await expect(page.locator('.challenge-catalog-controls').getByRole('status')).toContainText(
    /updated/i,
  );
  for (const challengeName of ['No-HUD Run', 'Random Loadout']) {
    const assignedChallenge = page.locator('.challenge-catalog-list li').filter({
      hasText: challengeName,
    });
    await assignedChallenge.getByLabel('Available for future draws').uncheck();
    await assignedChallenge.getByRole('button', { name: 'Save challenge' }).click();
  }
  const playerC = page.locator('.challenge-card').filter({
    has: page.getByRole('heading', { name: "Player C's challenge" }),
  });
  await expect(playerC.getByRole('button', { name: 'Draw a challenge' })).toBeEnabled();

  await page.getByLabel(/timer duration for player a/i).fill('60');
  await playerA.getByRole('button', { name: 'Start' }).click();
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Remove Player A' }).click();
  await expect(
    page.locator('.challenge-card').filter({
      has: page.getByRole('heading', { name: "Player A's challenge" }),
    }),
  ).toHaveCount(0);
  await expect(
    page.locator('.challenge-card').filter({
      has: page.getByRole('heading', { name: "Player B's challenge" }),
    }),
  ).toBeVisible();
});

test('host wide-screen view lays out a 20-player roster in compact columns', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  for (let index = 1; index <= 20; index += 1) {
    await page.getByLabel(/player name/i).fill(`Player ${index}`);
    await page.getByRole('button', { name: /add player/i }).click();
  }
  await page.getByRole('button', { name: /start game night/i }).click();
  await page.getByRole('button', { name: 'Wide-screen view' }).click();

  await expect(page.locator('.wide-player-row')).toHaveCount(20);
  await expect(page.locator('.wide-card-score')).toHaveCount(20);
  await expect(page.getByRole('button', { name: 'Exit wide-screen view' })).toBeVisible();
});
