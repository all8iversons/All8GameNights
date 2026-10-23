import { expect, test } from '@playwright/test';
import { installMockBackend } from './mock-backend';

test('historical results page shows a clear empty state', async ({ page }) => {
  await installMockBackend(page);
  await page.goto('/');
  await page.getByRole('button', { name: /hall of fame/i }).click();
  await expect(page.getByRole('heading', { name: /hall of fame/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /no champions yet/i })).toBeVisible();

  await page.getByRole('button', { name: /^play$/i }).click();
  await page.getByRole('button', { name: /create game night/i }).click();
  await page.getByLabel(/player name/i).fill('Riley');
  await page.getByRole('button', { name: /add player/i }).click();
  await page.getByLabel(/player name/i).fill('Jordan');
  await page.getByRole('button', { name: /add player/i }).click();
  await page.getByRole('button', { name: /start game night/i }).click();
  await page.getByRole('button', { name: /add 100 points to Riley/i }).click();
  await page.getByRole('button', { name: /add 100 points to Jordan/i }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /end game night/i }).click();
  await expect(page.getByRole('heading', { name: /final standings/i })).toBeVisible();

  await page.getByRole('button', { name: /hall of fame/i }).click();
  await expect(page.getByText(/Riley & Jordan/i)).toBeVisible();
  await expect(page.getByText(/Riley: 100 · Jordan: 100/i)).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /hall of fame/i }).click();
  await expect(page.getByText(/Riley & Jordan/i)).toBeVisible();
});
