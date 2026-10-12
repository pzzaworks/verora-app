import { test, expect } from '@playwright/test';

test.describe('Dashboard - Without Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should show dashboard title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should show connect wallet prompt', async ({ page }) => {
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });

  test('should show description about managing stakes and queries', async ({ page }) => {
    await expect(page.getByText(/manage your staking positions and queries/i)).toBeVisible();
  });

  test('should have connect wallet button', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();
  });

  test('should not show stat cards without wallet', async ({ page }) => {
    // Stat cards (Total Staked, Pending Rewards, Queries) should not be visible without connection
    const totalStaked = page.getByText(/total staked/i);
    const count = await totalStaked.count();
    expect(count).toBe(0);
  });

  test('should not show Stakes or Queries tabs without wallet', async ({ page }) => {
    const stakesTab = page.getByRole('button', { name: /stakes/i });
    const count = await stakesTab.count();
    expect(count).toBe(0);
  });
});
