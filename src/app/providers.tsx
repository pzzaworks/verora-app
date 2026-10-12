'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { type ReactNode, useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { WagmiProvider } from 'wagmi';

import { config } from '@/config/wagmi';
import { CookieBanner } from '@/components/shared/cookie-banner';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <CookieBanner />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#fffef2',
              color: '#191918',
              fontSize: '14px',
              borderRadius: '12px',
              padding: '12px 16px',
              border: '1px solid #e5e4db',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
            },
            success: {
              iconTheme: {
                primary: '#16a34a',
                secondary: '#fffef2',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fffef2',
              },
            },
          }}
        />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
