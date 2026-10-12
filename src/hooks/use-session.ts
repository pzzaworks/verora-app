'use client';

import { useCallback, useState } from 'react';
import { useAccount, useSignMessage } from 'wagmi';
import { createSiweMessage } from 'viem/siwe';
import { targetChain } from '@/config/wagmi';
import { api } from '@/lib/api';

interface Session {
  token: string;
  address: string;
  expiresAt: number;
}

/**
 * Sign-In with Ethereum against the Verora API. The session token is kept in memory only (never in
 * storage), and is only needed for authenticated calls such as metadata uploads.
 */
export function useApiSession() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [session, setSession] = useState<Session | null>(null);

  const signIn = useCallback(async (): Promise<string> => {
    if (!address) throw new Error('Connect a wallet first');
    if (session && session.address === address.toLowerCase() && session.expiresAt > Date.now() + 60_000) {
      return session.token;
    }

    const { nonce } = await api.getNonce();
    const message = createSiweMessage({
      address,
      chainId: targetChain.id,
      domain: window.location.host,
      nonce,
      uri: window.location.origin,
      version: '1',
      issuedAt: new Date(),
      statement: 'Sign in to Verora to publish agent metadata.',
    });
    const signature = await signMessageAsync({ message });
    const result = await api.verify(message, signature);

    setSession({ token: result.token, address: result.address, expiresAt: Date.now() + result.expiresIn * 1000 });
    return result.token;
  }, [address, session, signMessageAsync]);

  return { signIn, isSignedIn: !!session && session.address === address?.toLowerCase() };
}
