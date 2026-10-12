import { test, expect, type Page } from '@playwright/test';
import { API_URL, TEST_ACCOUNTS, connectWallet, increaseTime, installTestWallet } from './support/test-wallet';

/**
 * Wallet-connected flows against the local stack (startup.sh): real transactions and signatures on Anvil,
 * answers delivered by the oracle and the mock agent. Tests share chain state, so they run in order.
 */
test.describe.configure({ mode: 'serial' });

let agentId: string;

test.beforeAll(async () => {
  const res = await fetch(`${API_URL}/agents?limit=100`);
  const body = (await res.json()) as { data: Array<{ id: string; owner: string; status: string }> };
  const agent = body.data.find(
    (a) => a.owner.toLowerCase() === TEST_ACCOUNTS.agentOwner.toLowerCase() && a.status === 'active',
  );
  if (!agent) throw new Error('No active agent owned by the seeded agent owner; run startup.sh first');
  agentId = agent.id;
});

async function openAgentTab(page: Page, tab: 'Query' | 'Staking') {
  await page.goto(`/agents/${agentId}`);
  await page.getByRole('button', { name: tab, exact: true }).click();
  await connectWallet(page);
}

async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 30000 });
}

test.describe('Wallet - user', () => {
  test.beforeEach(async ({ page }) => {
    await installTestWallet(page, TEST_ACCOUNTS.user);
  });

  test('registers an agent with hosted metadata', async ({ page }) => {
    await page.goto('/agents/register');
    await connectWallet(page);
    await page.locator('#name').fill(`E2E Agent ${Date.now()}`);
    await page.locator('#description').fill('Registered by the wallet e2e suite.');
    await page.locator('#endpoint').fill('http://localhost:4102/query');
    await page.locator('#capabilities').fill('e2e, testing');
    await page.getByRole('button', { name: 'Register Agent On-Chain' }).click();

    await expect(page.getByRole('heading', { name: 'Agent Registered On-Chain!' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Save Your Encryption Secret Key')).toBeVisible();
  });

  test('stakes on an agent', async ({ page }) => {
    await openAgentTab(page, 'Staking');
    await page.getByPlaceholder('0.00').fill('1');
    await page.getByRole('button', { name: 'Stake ETH' }).click();
    await expectToast(page, 'Staked successfully');
    await expect(page.getByText('Staked Balance').locator('..')).toContainText(/[1-9]/);
  });

  test('sends a plaintext query and shows the answer', async ({ page }) => {
    test.setTimeout(120000);
    await openAgentTab(page, 'Query');
    await page.getByPlaceholder('What is the ETH price?').fill('What is the ETH price?');
    await page.getByRole('button', { name: 'Send query' }).click();
    await expectToast(page, 'Query submitted');

    const answer = page.locator('pre').first();
    await expect(answer).toBeVisible({ timeout: 90000 });
    await expect(answer).not.toBeEmpty();

    await page.getByRole('link', { name: 'View query details' }).click();
    await expect(page).toHaveURL(/\/queries\/0x[0-9a-f]{64}$/);
    await expect(page.getByRole('heading', { name: 'Query', exact: true })).toBeVisible();
    await expect(page.getByText('What is the ETH price?')).toBeVisible();
  });

  test('sends an encrypted query and decrypts the answer', async ({ page }) => {
    test.setTimeout(120000);
    await openAgentTab(page, 'Query');
    const encrypt = page.getByLabel('End-to-end encrypt prompt and answer');
    await expect(encrypt).toBeEnabled();
    await encrypt.check();
    await page.getByPlaceholder('What is the ETH price?').fill('Encrypted: what is the ETH price?');
    await page.getByRole('button', { name: 'Send query' }).click();
    await expectToast(page, 'Query submitted');

    const answer = page.locator('pre').first();
    await expect(answer).toBeVisible({ timeout: 90000 });
    const unlock = page.getByRole('button', { name: 'Unlock to decrypt' });
    if (await unlock.isVisible()) await unlock.click();
    await expect(answer).not.toContainText('Unlock your encryption key');
    await expect(answer).not.toContainText('not encrypted for the connected wallet');
    await expect(answer).not.toBeEmpty();
  });

  test('claims staking rewards earned from queries', async ({ page }) => {
    await openAgentTab(page, 'Staking');
    const claim = page.getByRole('button', { name: 'Claim', exact: true });
    await expect(claim).toBeEnabled({ timeout: 15000 });
    await claim.click();
    await expectToast(page, 'Rewards claimed');
  });

  test('unbonds and withdraws after the unstaking period', async ({ page }) => {
    await openAgentTab(page, 'Staking');
    await page.getByRole('button', { name: 'Unstake', exact: true }).click();
    await page.getByPlaceholder('0.00').fill('1');
    await page.getByRole('button', { name: 'Start unbonding' }).click();
    await expectToast(page, 'Unbonding started');

    // Unstaking period on the local deployment is well under 30 days
    await increaseTime(30 * 24 * 60 * 60 + 1);
    await page.reload();
    await page.getByRole('button', { name: 'Staking', exact: true }).click();
    const withdraw = page.getByRole('button', { name: /^Withdraw .*ETH/ });
    await expect(withdraw).toBeEnabled({ timeout: 15000 });
    await withdraw.click();
    await expectToast(page, 'Stake withdrawn');
  });
});

test.describe('Wallet - agent owner', () => {
  test.beforeEach(async ({ page }) => {
    await installTestWallet(page, TEST_ACCOUNTS.agentOwner);
  });

  test('withdraws agent fees from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await connectWallet(page);
    const withdraw = page.getByRole('button', { name: 'Withdraw', exact: true });
    await expect(withdraw).toBeEnabled({ timeout: 15000 });
    await withdraw.click();
    await expectToast(page, 'Fees withdrawn');
  });
});
