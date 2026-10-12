import { test, expect } from '@playwright/test';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4100';

// --------------------------------------------------------------------------
// Dashboard - No Wallet Connected
// --------------------------------------------------------------------------
test.describe('Dashboard - No Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('should show dashboard heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should show connect wallet prompt when no wallet connected', async ({ page }) => {
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });

  test('should have a connect wallet button', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();
  });
});

// --------------------------------------------------------------------------
// Agent Registration - No Wallet Connected
// --------------------------------------------------------------------------
test.describe('Agent Registration - No Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents/register');
    await page.waitForLoadState('networkidle');
  });

  test('should show connect wallet prompt', async ({ page }) => {
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });

  test('should display registration page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /register agent/i })).toBeVisible();
  });

  test('should have connect wallet button', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtn).toBeVisible();
  });

  test('should not show the registration form fields without wallet', async ({ page }) => {
    // Form fields should be hidden behind the connect wallet prompt
    const nameInput = page.locator('#name');
    const isVisible = await nameInput.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

// --------------------------------------------------------------------------
// Agent Detail - Staking Tab Without Wallet
// --------------------------------------------------------------------------
test.describe('Agent Detail - Staking Tab Without Wallet', () => {
  let agentOnChainId: string;

  test.beforeAll(async () => {
    const res = await fetch(`${API_URL}/agents?limit=1`);
    const data = await res.json();
    agentOnChainId = data.data[0]?.id;
  });

  test('should show connect wallet message on staking tab', async ({ page }) => {
    test.skip(!agentOnChainId, 'No agents available');

    await page.goto(`/agents/${agentOnChainId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Staking' }).click();

    // Should show connect wallet prompt for staking and position
    await expect(page.getByText(/connect wallet to stake/i)).toBeVisible();
    await expect(page.getByText(/connect wallet to view position/i)).toBeVisible();
  });

  test('staking tab should have connect wallet button', async ({ page }) => {
    test.skip(!agentOnChainId, 'No agents available');

    await page.goto(`/agents/${agentOnChainId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Staking' }).click();

    const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtn).toBeVisible();
  });
});

// --------------------------------------------------------------------------
// Connect Wallet Buttons - Across Protected Pages
// --------------------------------------------------------------------------
test.describe('Connect Wallet Buttons on Protected Pages', () => {
  const protectedRoutes = [
    { path: '/dashboard', name: 'Dashboard' },
    { path: '/agents/register', name: 'Agent Registration' },
  ];

  for (const route of protectedRoutes) {
    test(`${route.name} page has a connect wallet button`, async ({ page }) => {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      const connectButton = page.getByRole('button', { name: /connect wallet/i }).first();
      await expect(connectButton).toBeVisible();
    });
  }

  test('Navbar has wallet connect button on any page', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // The navbar should have a connect/wallet button
    const navConnectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    const walletBtn = page.getByRole('button', { name: /wallet/i }).first();

    const hasNavConnect = await navConnectBtn.isVisible().catch(() => false);
    const hasWalletBtn = await walletBtn.isVisible().catch(() => false);

    expect(hasNavConnect || hasWalletBtn).toBeTruthy();
  });

  test('Agent detail staking tab shows connect wallet prompt', async ({ page }) => {
    const res = await fetch(`${API_URL}/agents?limit=1`);
    const data = await res.json();
    const agentOnChainId = data.data[0]?.id;

    test.skip(!agentOnChainId, 'No agents available');

    await page.goto(`/agents/${agentOnChainId}`);
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Staking' }).click();

    const connectElements = page.getByText(/connect wallet/i);
    await expect(connectElements.first()).toBeVisible();
  });
});
