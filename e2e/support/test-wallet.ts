import type { Page } from '@playwright/test';

export const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
export const API_URL = process.env.API_URL || 'http://localhost:4100';

/** Unlocked Anvil dev accounts (public test keys); Anvil signs and sends on their behalf */
export const TEST_ACCOUNTS = {
  /** Agent owner seeded by startup.sh; the mock agent answers for it */
  agentOwner: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  /** Not used by startup.sh, so it acts as a regular user */
  user: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
} as const;

interface RpcResponse {
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export async function rpc(method: string, params: unknown[] = []): Promise<unknown> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const body = (await res.json()) as RpcResponse;
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
}

/** Moves chain time forward and mines a block */
export async function increaseTime(seconds: number): Promise<void> {
  await rpc('evm_increaseTime', [seconds]);
  await rpc('evm_mine');
}

/**
 * Injects an EIP-1193 provider as `window.ethereum` before the app loads. Account requests resolve to the
 * given Anvil dev account and every other call (transactions, signatures, reads) goes to the local node,
 * so the UI exercises real wallet flows without a browser extension.
 */
export async function installTestWallet(page: Page, account: string): Promise<void> {
  await page.addInitScript(
    ({ account, rpcUrl }) => {
      type Listener = (...args: unknown[]) => void;
      const listeners = new Map<string, Set<Listener>>();
      let nextId = 0;

      const forward = async (method: string, params: unknown[]): Promise<unknown> => {
        const res = await fetch(rpcUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: ++nextId, method, params }),
        });
        const body = (await res.json()) as {
          result?: unknown;
          error?: { code: number; message: string; data?: unknown };
        };
        if (body.error) {
          throw Object.assign(new Error(body.error.message), { code: body.error.code, data: body.error.data });
        }
        return body.result;
      };

      const provider = {
        async request({ method, params }: { method: string; params?: unknown[] }): Promise<unknown> {
          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return [account];
            case 'wallet_requestPermissions':
            case 'wallet_getPermissions':
              return [{ parentCapability: 'eth_accounts' }];
            case 'wallet_switchEthereumChain':
            case 'wallet_addEthereumChain':
            case 'wallet_revokePermissions':
              return null;
            default:
              return forward(method, params ?? []);
          }
        },
        on(event: string, listener: Listener) {
          const set = listeners.get(event) ?? new Set<Listener>();
          set.add(listener);
          listeners.set(event, set);
          return provider;
        },
        removeListener(event: string, listener: Listener) {
          listeners.get(event)?.delete(listener);
          return provider;
        },
      };

      Object.defineProperty(window, 'ethereum', { value: provider, configurable: true });
    },
    { account, rpcUrl: RPC_URL },
  );
}

/** Clicks the first visible "Connect Wallet" button and waits until the app shows the connected state */
export async function connectWallet(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /connect wallet/i }).first();
  await button.click();
  await button.waitFor({ state: 'detached', timeout: 10000 }).catch(() => undefined);
}
