import { expect, test } from '@playwright/test';
import { installMockBackend } from './mock-backend';

test('host creates a night, starts the game, and updates live scores', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  await expect(page.getByText('482731', { exact: true })).toBeVisible();
  await page.getByLabel(/player name/i).fill('Alex');
  await page.getByRole('button', { name: /add player/i }).click();
  await page.getByLabel(/player name/i).fill('Sam');
  await page.getByRole('button', { name: /add player/i }).click();
  await page.getByRole('button', { name: /start game night/i }).click();
  await expect(page.getByRole('heading', { name: /current standings/i })).toBeVisible();
  await page.getByLabel(/player name/i).fill('Taylor');
  await page.getByRole('button', { name: /add player/i }).click();
  await expect(
    page.getByRole('list', { name: /current standings/i }).getByText('Taylor'),
  ).toBeVisible();

  await page.getByLabel(/team name/i).fill('Team Red');
  await page.getByRole('button', { name: /add team/i }).click();
  await page.getByLabel(/team name/i).fill('Team Blue');
  await page.getByRole('button', { name: /add team/i }).click();
  await page.getByRole('button', { name: /randomize players across teams/i }).click();
  const teamStandings = page.getByRole('list', { name: /team standings/i });
  const teamMemberLists = await teamStandings.locator('.team-members').allTextContents();
  const teamMembers = teamMemberLists.map((list) =>
    list
      .replace(/^Players:\s*/, '')
      .split(', ')
      .filter(Boolean),
  );
  expect(Math.abs(teamMembers[0].length - teamMembers[1].length)).toBeLessThanOrEqual(1);
  await expect(page.getByRole('heading', { name: /team standings/i })).toBeVisible();
  for (const name of ['Alex', 'Sam', 'Taylor']) {
    await expect(teamStandings).toContainText(name);
  }

  await page.getByRole('button', { name: /add 100 points to Alex/i }).click();
  await expect(
    page
      .getByRole('list', { name: /current standings/i })
      .locator('.score-value')
      .first(),
  ).toHaveText('100');
  await expect(page.getByRole('list', { name: /team standings/i }).getByText('100')).toBeVisible();
  await expect(page.getByText(/anyone with this spectator code can submit/i)).toBeVisible();
  await page.getByRole('button', { name: /add 100 points to Sam/i }).click();
  await expect(
    page.getByRole('list', { name: /current standings/i }).getByLabel(/rank 1/i),
  ).toHaveCount(2);
});

test('joins a game night using a six-digit code', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  await page.getByRole('button', { name: /leave board/i }).click();
  const joinCode = page.getByLabel(/6-digit join code/i);
  const joinButton = page.getByRole('button', { name: /^join$/i });
  await joinCode.fill('48273');
  await expect(joinButton).toBeDisabled();
  await joinCode.fill('482731');
  await expect(joinButton).toBeEnabled();
  await joinButton.click();
  await expect(page.getByRole('heading', { name: /game night is on/i })).toBeVisible();
});

test('host privileges reconnect after a reload using the saved session', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  await expect(page.getByRole('heading', { name: /add your players/i })).toBeVisible();

  await page.reload();

  await expect(page.getByRole('heading', { name: /add your players/i })).toBeVisible();
  await expect(page.getByText('482731', { exact: true })).toBeVisible();
  await expect(page.getByText('Host view')).toBeVisible();
});

test('host can reconnect with the private recovery key', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  await page.getByText('Show host recovery key').click();
  await expect(page.getByText('a'.repeat(64), { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /leave board/i }).click();

  await page.getByLabel('Host room code').fill('482731');
  await page.getByLabel('Host recovery key').fill('a'.repeat(64));
  await page.getByRole('button', { name: /reconnect as host/i }).click();

  await expect(page.getByText('Host view')).toBeVisible();
  await expect(page.getByRole('heading', { name: /add your players/i })).toBeVisible();
});

test('spectator code alone cannot restore host privileges', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  await page.getByRole('button', { name: /leave board/i }).click();
  await page.getByLabel('Host room code').fill('482731');
  await page.getByLabel('Host recovery key').fill('0'.repeat(64));
  await page.getByRole('button', { name: /reconnect as host/i }).click();

  await expect(page.getByRole('alert')).toContainText(/host authorization is invalid/i);
  await expect(page.getByRole('button', { name: /create game night/i })).toBeVisible();
});

test('host generates teams by team count or players per team', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /create game night/i }).click();
  for (const name of ['Alex', 'Sam', 'Taylor']) {
    await page.getByLabel(/player name/i).fill(name);
    await page.getByRole('button', { name: /add player/i }).click();
  }
  await page.getByLabel(/team name/i).fill('Old team');
  await page.getByRole('button', { name: /add team/i }).click();
  await page.getByRole('button', { name: /start game night/i }).click();

  await page.getByLabel('Team setup method').selectOption('team_count');
  await page.getByLabel('Number of teams').fill('2');
  await page.getByRole('button', { name: /generate random teams/i }).click();
  let standings = page.getByRole('list', { name: /team standings/i });
  await expect(standings.getByText('Old team')).toHaveCount(0);
  await expect(standings.locator('li')).toHaveCount(2);
  await expect(standings).toContainText(/Aurora|Nebula|Comet|Lunar|Nova|Orbit/);

  await page.getByLabel('Team setup method').selectOption('players_per_team');
  await page.getByLabel('Players per team').fill('2');
  await page.getByRole('button', { name: /generate random teams/i }).click();
  standings = page.getByRole('list', { name: /team standings/i });
  await expect(standings.locator('li')).toHaveCount(2);
  for (const name of ['Alex', 'Sam', 'Taylor']) {
    await expect(standings).toContainText(name);
  }
});
