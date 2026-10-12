import { test, expect } from '@playwright/test';

// Every docs page in sidebar order, with its route and page title (h1).
const DOC_PAGES = [
  { path: '/docs', title: 'Overview' },
  { path: '/docs/concepts', title: 'Core Concepts' },
  { path: '/docs/quickstart', title: 'Quickstart' },
  { path: '/docs/guides/consumer-contract', title: 'Requesting Queries from a Contract' },
  { path: '/docs/guides/sdk', title: 'Using the SDK' },
  { path: '/docs/guides/running-an-agent', title: 'Running an Agent' },
  { path: '/docs/guides/staking', title: 'Staking and Delegation' },
  { path: '/docs/guides/encryption', title: 'End-to-End Encryption' },
  { path: '/docs/guides/local-development', title: 'Local Development' },
  { path: '/docs/guides/deploying-contracts', title: 'Deploying the Contracts' },
  { path: '/docs/reference/contracts/agent-registry', title: 'AgentRegistry' },
  { path: '/docs/reference/contracts/query-consumer', title: 'QueryConsumer' },
  { path: '/docs/reference/contracts/staking-pool', title: 'StakingPool' },
  { path: '/docs/reference/contracts/payment-router', title: 'PaymentRouter' },
  { path: '/docs/reference/contracts/reputation-manager', title: 'ReputationManager' },
  { path: '/docs/reference/contracts/treasury', title: 'Treasury' },
  { path: '/docs/reference/contracts/verora-consumer', title: 'VeroraConsumer' },
  { path: '/docs/reference/query-lifecycle', title: 'Query Lifecycle' },
  { path: '/docs/reference/fees', title: 'Fees and Economics' },
  { path: '/docs/reference/agent-protocol', title: 'Agent Protocol' },
  { path: '/docs/reference/sdk', title: 'SDK Reference' },
  { path: '/docs/reference/rest-api', title: 'REST API' },
  { path: '/docs/reference/configuration', title: 'Configuration' },
  { path: '/docs/reference/deployments', title: 'Deployments' },
  { path: '/docs/architecture', title: 'Architecture' },
  { path: '/docs/security', title: 'Security Model' },
  { path: '/docs/faq', title: 'FAQ and Troubleshooting' },
] as const;

test.describe('Documentation', () => {
  test.describe('Overview page', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/docs');
      await page.waitForLoadState('networkidle');
    });

    test('should display the docs title and Verora intro', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 1, name: 'Overview' })).toBeVisible();
      await expect(page.getByText(/decentralized ai agent oracle protocol/i).first()).toBeVisible();
    });

    test('should show "no API keys needed" messaging', async ({ page }) => {
      await expect(page.getByText(/no api keys/i).first()).toBeVisible();
    });

    test('should show on-chain first info cards', async ({ page }) => {
      await expect(page.getByText(/on-chain first/i)).toBeVisible();
      await expect(page.getByText(/end-to-end encryption/i).first()).toBeVisible();
    });

    test('should have sidebar navigation with all pages', async ({ page }) => {
      for (const doc of DOC_PAGES) {
        await expect(page.locator(`a[href="${doc.path}"]`).first()).toBeAttached();
      }
    });

    test('should navigate to the next page', async ({ page }) => {
      await page.getByRole('link', { name: /core concepts/i }).last().click();
      await expect(page).toHaveURL(/\/docs\/concepts$/);
      await expect(page.getByRole('heading', { level: 1, name: 'Core Concepts' })).toBeVisible();
    });
  });

  for (const doc of DOC_PAGES) {
    test(`should render the ${doc.title} page`, async ({ page }) => {
      const response = await page.goto(doc.path);
      expect(response?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1, name: doc.title, exact: true })).toBeVisible();
    });
  }

  test('should group every contract under the Contracts sidebar folder', async ({ page }) => {
    // The folder only groups the contract pages; it has no page of its own.
    const folderResponse = await page.request.get('/docs/reference/contracts');
    expect(folderResponse.status()).toBe(404);

    await page.goto('/docs/reference/contracts/agent-registry');
    const sidebar = page.getByRole('navigation', { name: 'Documentation' });
    for (const name of [
      'AgentRegistry',
      'QueryConsumer',
      'StakingPool',
      'PaymentRouter',
      'ReputationManager',
      'Treasury',
      'VeroraConsumer',
    ]) {
      await expect(sidebar.getByRole('link', { name, exact: true })).toBeVisible();
    }
  });

  test('should show the smart contract integration sample', async ({ page }) => {
    await page.goto('/docs/guides/consumer-contract');
    await expect(page.locator('pre').filter({ hasText: 'contract MyDApp is VeroraConsumer' })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'How it works' })).toContainText('_cancelRequest()');
  });

  test('should show the encryption security note', async ({ page }) => {
    await page.goto('/docs/guides/encryption');
    await expect(page.getByRole('heading', { name: 'How It Works', exact: true })).toBeVisible();
    await expect(page.getByRole('note').filter({ hasText: 'Security Note' })).toBeVisible();
  });

  test('should document the agent protocol request fields', async ({ page }) => {
    await page.goto('/docs/reference/agent-protocol');
    const content = page.locator('main');
    for (const field of ['queryConsumer', 'queryId', 'agentId', 'queryData', 'deadline', 'responseData', 'signature']) {
      await expect(content.getByText(field, { exact: true }).first()).toBeAttached();
    }
  });

  test('should have code blocks with copy buttons', async ({ page }) => {
    await page.goto('/docs/guides/staking');
    await expect(page.locator('pre').first()).toContainText('StakingPool.stake');
    await expect(page.getByRole('button', { name: /copy/i }).first()).toBeAttached();
  });

  test('should serve page Markdown for LLMs', async ({ request }) => {
    const response = await request.get('/docs/guides/staking.mdx');
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('StakingPool.claimRewards');
  });

  test('should not have x402 as a standalone section', async ({ page }) => {
    // The old docs had a dedicated x402 section - verify it is gone from every page
    for (const doc of DOC_PAGES) {
      await page.goto(doc.path);
      await expect(page.locator('h1, h2').filter({ hasText: /x402/i })).toHaveCount(0);
    }
  });
});
