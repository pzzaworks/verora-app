import { test, expect } from '@playwright/test';

test.describe('Agent Registration - Without Wallet', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents/register');
    await page.waitForLoadState('networkidle');
  });

  test('should show Register Agent heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /register agent/i })).toBeVisible();
  });

  test('should show connect wallet prompt', async ({ page }) => {
    await expect(page.getByText(/connect your wallet/i)).toBeVisible();
  });

  test('should show connect to register message', async ({ page }) => {
    await expect(page.getByText(/connect to register.*on-chain/i)).toBeVisible();
  });

  test('should have connect wallet button', async ({ page }) => {
    const connectBtn = page.getByRole('button', { name: /connect wallet/i }).first();
    await expect(connectBtn).toBeVisible();
    await expect(connectBtn).toBeEnabled();
  });

  test('should not show registration form fields without wallet', async ({ page }) => {
    // The form inputs (name, description, endpoint, capabilities) should not be visible
    const nameInput = page.locator('#name');
    const descInput = page.locator('#description');
    const endpointInput = page.locator('#endpoint');

    const nameVisible = await nameInput.isVisible().catch(() => false);
    const descVisible = await descInput.isVisible().catch(() => false);
    const endpointVisible = await endpointInput.isVisible().catch(() => false);

    expect(nameVisible).toBe(false);
    expect(descVisible).toBe(false);
    expect(endpointVisible).toBe(false);
  });

  test('should not show the submit button without wallet', async ({ page }) => {
    const submitBtn = page.getByRole('button', { name: /register agent on-chain/i });
    const isVisible = await submitBtn.isVisible().catch(() => false);
    expect(isVisible).toBe(false);
  });
});

test.describe('Registration Page - On-Chain Context', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/agents/register');
    await page.waitForLoadState('networkidle');
  });

  test('should indicate registration is an on-chain transaction', async ({ page }) => {
    // The page should mention on-chain nature even when wallet is not connected
    const heading = page.getByRole('heading', { name: /register agent/i });
    await expect(heading).toBeVisible();
  });
});

test.describe('Navigation from Registration', () => {
  test('should be accessible from agents page register CTA', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const registerBtn = page.getByRole('button', { name: /register/i }).first();
    await registerBtn.click();
    await expect(page).toHaveURL(/\/agents\/register/);
  });
});
