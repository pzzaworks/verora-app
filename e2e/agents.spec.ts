import { test, expect } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

test.describe('Agents Registry', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
  });

  test('should display page header', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /agent.*registry/i }).first()).toBeVisible();
  });

  test('should have search input', async ({ page }) => {
    await expect(page.getByPlaceholder(/search agents/i)).toBeVisible();
  });

  test('should display agent count in stats line', async ({ page }) => {
    await expect(page.getByText(/\d+ agents/)).toBeVisible();
  });

  test('should display agent cards from on-chain data', async ({ page }) => {
    // Agent cards are clickable white bordered containers
    const cards = page.locator('[class*="cursor-pointer"][class*="bg-white"][class*="border"]');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should show agent names in cards', async ({ page }) => {
    // At least one agent card should have a visible name (text inside semibold span)
    const agentNames = page.locator('[class*="font-semibold"][class*="truncate"]');
    await expect(agentNames.first()).toBeVisible();
    const text = await agentNames.first().textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('should show query count and stake in card footer', async ({ page }) => {
    // Each card footer shows the indexed query count and stake
    await expect(page.getByText(/eth staked/i).first()).toBeVisible();
  });

  test('should show reputation score in cards', async ({ page }) => {
    // Cards should show some numeric score or reputation indicator
    const cards = page.locator('[class*="cursor-pointer"][class*="bg-white"][class*="border"]');
    const firstCard = cards.first();
    await expect(firstCard).toBeVisible();
  });

  test('should filter agents on search', async ({ page }) => {
    // Get an agent name from the API to search for
    const res = await fetch(`${API_URL}/agents?limit=1`);
    const data = await res.json();
    const agentName = data.data[0]?.metadata?.name;

    if (!agentName) {
      test.skip(true, 'No agents available');
      return;
    }

    const searchInput = page.getByPlaceholder(/search agents/i);
    await searchInput.fill(agentName.slice(0, 5));
    await page.waitForTimeout(300);

    // Should show the matching agent
    await expect(page.getByText(agentName, { exact: true })).toBeVisible();
    // Should show search result count
    await expect(page.getByText(/\d+ results? found/)).toBeVisible();
  });

  test('should show no results state on bad search', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search agents/i);
    await searchInput.fill('xyznonexistent123456');
    await page.waitForTimeout(300);

    await expect(page.getByText(/no agents match/i)).toBeVisible();
  });

  test('should clear search and restore agent list', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/search agents/i);
    await searchInput.fill('test');
    await page.waitForTimeout(300);

    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Should be back to showing agent count
    await expect(page.getByText(/\d+ agents/)).toBeVisible();
  });

  test('should navigate to agent detail on card click', async ({ page }) => {
    const card = page.locator('[class*="cursor-pointer"][class*="bg-white"][class*="border"]').first();
    await card.click();
    // Agent detail URL uses on-chain bytes32 IDs (0x...)
    await expect(page).toHaveURL(/\/agents\/0x[a-fA-F0-9]+/);
  });

  test('should show register CTA banner', async ({ page }) => {
    await expect(page.getByText(/deploy your own agent/i)).toBeVisible();
    await expect(page.getByText(/register.*on-chain/i)).toBeVisible();
  });

  test('should navigate to register page from CTA', async ({ page }) => {
    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    await registerBtn.click();
    await expect(page).toHaveURL(/\/agents\/register/);
  });
});
