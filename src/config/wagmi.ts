import { http, createConfig } from 'wagmi';
import { foundry, sepolia } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

/** Networks the app can target: a local Anvil node for development and Ethereum Sepolia (Etherscan explorer) */
const CHAINS = { foundry, sepolia } as const;
type ChainKey = keyof typeof CHAINS;

function resolveChain(value: string | undefined) {
  if (value && value in CHAINS) return CHAINS[value as ChainKey];
  throw new Error(`NEXT_PUBLIC_CHAIN must be one of: ${Object.keys(CHAINS).join(', ')}`);
}

/** The single network this deployment of the app targets */
export const targetChain = resolveChain(process.env.NEXT_PUBLIC_CHAIN);

/** Optional dedicated RPC (recommended for public networks); falls back to the chain's public RPC */
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || undefined;

export const config = createConfig({
  chains: [targetChain],
  connectors: [injected()],
  // Only the target chain is used; the map is keyed by every supported chain to satisfy the types
  transports: {
    [foundry.id]: http(rpcUrl),
    [sepolia.id]: http(rpcUrl),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
