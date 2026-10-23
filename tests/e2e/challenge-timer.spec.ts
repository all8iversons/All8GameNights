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
  await page.getByRole('button', { name: /finish challenge/i }).first().click();
  await page.getByRole('button', { name: /draw next challenge/i }).first().click();
  await expect(page.getByRole('heading', { name: /random loadout/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /one-life challenge/i })).toBeVisible();
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

  await playerA.getByLabel('Trade challenge with a teammate').selectOption('player-2');
  await playerA.getByRole('button', { name: 'Trade challenges' }).click();
  await expect(playerA.getByRole('heading', { name: /random loadout/i })).toBeVisible();
  await expect(playerB.getByRole('heading', { name: /no-hud run/i })).toBeVisible();

  await page.getByLabel(/timer duration for player a/i).fill('30');
  await page.getByRole('button', { name: /^start$/i }).first().click();
  await expect(playerA.getByText(/pause or stop both timers before trading/i)).toBeVisible();
  await expect(playerA.getByLabel('Trade challenge with a teammate')).toHaveCount(0);
});
