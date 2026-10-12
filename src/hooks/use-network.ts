'use client';

import { useAccount } from 'wagmi';
import { targetChain } from '@/config/wagmi';
import { useIsClient } from './use-is-client';

/** True when a wallet is connected to a chain other than the one this deployment targets */
export function useIsWrongNetwork(): boolean {
  const { isConnected, chainId } = useAccount();
  const mounted = useIsClient();
  return mounted && isConnected && chainId !== targetChain.id;
}
