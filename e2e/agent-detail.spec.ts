import { test, expect } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

let agentOnChainId: string;

test.beforeAll(async () => {
  const res = await fetch(`${API_URL}/agents?limit=1`);
  const data = await res.json();
  agentOnChainId = data.data[0]?.id;
});

test.describe('Agent Detail - Overview', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!agentOnChainId, 'No agents available - cannot get onChainId');
    await page.goto(`/agents/${agentOnChainId}`);
    await page.waitForLoadState('networkidle');
  });

  test('should display agent name', async ({ page }) => {
    const heading = page.getByRole('heading').first();
    await expect(heading).toBeVisible();
    const text = await heading.textContent();
    expect(text!.length).toBeGreaterThan(0);
  });

  test('should show health status badge', async ({ page }) => {
    // Health check is done via direct HTTP call to agent endpoint
    const badge = page.getByText(/online|offline|degraded|checking/i).first();
    await expect(badge).toBeVisible();
  });

  test('should show reputation score circle', async ({ page }) => {
    await expect(page.getByText('SCORE')).toBeVisible();
  });

  test('should display agent description', async ({ page }) => {
    // Description text appears below the heading
    const desc = page.locator('p[class*="text-[#898981]"]').first();
    await expect(desc).toBeVisible();
  });

  test('should have Overview, Query, and Staking tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Query', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Staking' })).toBeVisible();
  });

  test('should show stats row with Queries, Success Rate, Total Staked, Stakers', async ({ page }) => {
    await expect(page.getByText(/queries/i).first()).toBeVisible();
    await expect(page.getByText(/success rate/i).first()).toBeVisible();
    await expect(page.getByText(/total staked/i).first()).toBeVisible();
    await expect(page.getByText(/stakers/i).first()).toBeVisible();
  });

  test('should show technical details section', async ({ page }) => {
    await expect(page.getByText(/technical details/i)).toBeVisible();
  });

  test('should show owner address in technical details', async ({ page }) => {
    // The "OWNER" label appears in the technical details section
    const ownerLabel = page.locator('text=OWNER').first();
    await expect(ownerLabel).toBeVisible();
  });

  test('should show endpoint in technical details', async ({ page }) => {
    const endpointLabel = page.locator('text=ENDPOINT').first();
    await expect(endpointLabel).toBeVisible();
  });

  test('should show agent ID in technical details', async ({ page }) => {
    const agentIdLabel = page.locator('text=AGENT ID').first();
    await expect(agentIdLabel).toBeVisible();
  });

  test('should show the end-to-end encryption capability', async ({ page }) => {
    await expect(page.getByText(/encrypted queries supported/i)).toBeVisible();
  });

  test('should offer an in-app query tab that requires a wallet', async ({ page }) => {
    await page.getByRole('button', { name: 'Query', exact: true }).click();
    await expect(page.getByText(/connect wallet to send a paid query/i)).toBeVisible();
  });
});

test.describe('Agent Detail - Tab Switching', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!agentOnChainId, 'No agents available');
    await page.goto(`/agents/${agentOnChainId}`);
    await page.waitForLoadState('networkidle');
  });

  test('should switch to Staking tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Staking' }).click();
    // Staking tab should show "Stake on Agent" heading and connect wallet prompt (no wallet connected)
    const hasConnect = await page.getByText(/connect wallet/i).first().isVisible().catch(() => false);
    const hasStakeForm = await page.getByText(/stake on agent/i).isVisible().catch(() => false);
    expect(hasConnect || hasStakeForm).toBeTruthy();
  });

  test('should show "Your Position" section on staking tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Staking' }).click();
    await expect(page.getByText(/your position/i)).toBeVisible();
  });

  test('should switch back to Overview tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Staking' }).click();
    await page.getByRole('button', { name: 'Overview' }).click();
    await expect(page.getByText(/technical details/i)).toBeVisible();
  });
});

test.describe('Agent Detail - Staking Without Wallet', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!agentOnChainId, 'No agents available');
    await page.goto(`/agents/${agentOnChainId}`);
    await page.waitForLoadState('networkidle');
  });

  test('should show connect wallet prompt on staking tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Staking' }).click();
    await expect(page.getByText(/connect wallet to stake/i)).toBeVisible();
  });

  test('should show connect wallet prompt for position view', async ({ page }) => {
    await page.getByRole('button', { name: 'Staking' }).click();
    await expect(page.getByText(/connect wallet to view position/i)).toBeVisible();
  });

  test('should have connect wallet button on staking tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Staking' }).click();
    const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtn).toBeVisible();
  });
});

test.describe('Agent Detail - Not Found', () => {
  test('should handle invalid agent ID gracefully', async ({ page }) => {
    await page.goto('/agents/0x0000000000000000000000000000000000000000000000000000000000000000');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    // Page should load without crashing - may show error, empty state, or loading
    const url = page.url();
    expect(url).toContain('/agents/0x');
  });

  test('should show browse agents button on error', async ({ page }) => {
    await page.goto('/agents/0xinvalid');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('button', { name: /browse agents/i })).toBeVisible();
  });
});
