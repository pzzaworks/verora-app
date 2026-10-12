import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render hero section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /oracle layer.*onchain/i })).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    const nav = page.getByRole('navigation');
    await expect(nav.getByRole('link', { name: 'DOCS' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'AGENTS' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'DASHBOARD' })).toBeVisible();
  });

  test('should have CTA buttons in hero', async ({ page }) => {
    await expect(page.getByRole('link', { name: /explore agents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /read docs/i })).toBeVisible();
  });

  test('should show protocol feature badges', async ({ page }) => {
    await expect(page.getByText('E2E Encrypted')).toBeVisible();
    await expect(page.getByText('On-chain Payments')).toBeVisible();
    await expect(page.getByText('Built on Ethereum')).toBeVisible();
    await expect(page.getByText('ERC-8004')).toBeVisible();
  });

  test('should show how-it-works section', async ({ page }) => {
    await expect(page.getByText(/ai inference/i)).toBeVisible();
    await expect(page.getByText(/your contracts.*can trust/i)).toBeVisible();
  });

  test('should show agent network section', async ({ page }) => {
    await expect(page.getByText(/agent network/i)).toBeVisible();
    await expect(page.getByText(/specialized agents/i)).toBeVisible();
  });

  test('should show core protocol features', async ({ page }) => {
    await expect(page.getByText('E2E ENCRYPTION', { exact: true })).toBeVisible();
    await expect(page.getByText('ECONOMIC SECURITY', { exact: true })).toBeVisible();
    await expect(page.getByText('REPUTATION SCORES', { exact: true })).toBeVisible();
  });

  test('should have FAQ section', async ({ page }) => {
    await expect(page.getByText(/what makes verora different/i)).toBeVisible();
    await expect(page.getByText(/how do agents earn revenue/i)).toBeVisible();
    await expect(page.getByText(/is my query data private/i)).toBeVisible();
  });

  test('should toggle FAQ accordion', async ({ page }) => {
    const faqButton = page.getByText(/what makes verora different/i);
    await faqButton.click();
    await expect(page.getByText(/chainlink focuses on external data/i)).toBeVisible();

    // Close it
    await faqButton.click();
    await expect(page.getByText(/chainlink focuses on external data/i)).not.toBeVisible();
  });

  test('should have bottom CTA section', async ({ page }) => {
    await expect(page.getByText(/start building/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /browse agents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /view documentation/i })).toBeVisible();
  });

  test('should navigate to agents page via CTA', async ({ page }) => {
    await page.getByRole('link', { name: /explore agents/i }).click();
    await expect(page).toHaveURL(/\/agents/);
  });

  test('should navigate to docs page via CTA', async ({ page }) => {
    await page.getByRole('link', { name: /read docs/i }).click();
    await expect(page).toHaveURL(/\/docs/);
  });
});
