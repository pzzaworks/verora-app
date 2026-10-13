import { http, createConfig } from 'wagmi';
import { foundry, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';
import { failover } from '@/lib/failover-transport';

/** Networks the app can target: a local Anvil node for development and Ethereum Sepolia (Etherscan explorer) */
const CHAINS = { foundry, sepolia } as const;
type ChainKey = keyof typeof CHAINS;

function resolveChain(value: string | undefined) {
  if (value && value in CHAINS) return CHAINS[value as ChainKey];
  throw new Error(`NEXT_PUBLIC_CHAIN must be one of: ${Object.keys(CHAINS).join(', ')}`);
}

/** The single network this deployment of the app targets */
export const targetChain = resolveChain(process.env.NEXT_PUBLIC_CHAIN);

/**
 * Optional comma-separated RPC endpoints, used one at a time and failed over in order when the active one
 * stops answering; without any, the chain's default public RPC is used
 */
const rpcUrls = (process.env.NEXT_PUBLIC_RPC_URL ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const transport = rpcUrls.length > 0 ? failover(rpcUrls, { timeout: 10_000 }) : http();

export const config = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  // Only the target chain is used; the map is keyed by every supported chain to satisfy the types
  transports: {
    [foundry.id]: transport,
    [sepolia.id]: transport,
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
