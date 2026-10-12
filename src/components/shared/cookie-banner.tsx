'use client';

import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

/** localStorage key recording that the storage notice was dismissed */
const NOTICE_KEY = 'verora_storage_notice';

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_KEY) === '1';
  } catch {
    // Storage can be blocked (private mode, site data disabled); show the notice in that case
    return false;
  }
}

function dismiss(): void {
  try {
    window.localStorage.setItem(NOTICE_KEY, '1');
  } catch {
    // Without storage the notice simply shows again on the next visit
  }
  listeners.forEach((listener) => listener());
}

/**
 * One-time notice about browser storage. The app sets no cookies and runs no analytics, so there is
 * nothing to consent to; it only explains the local storage the app needs to work.
 */
export function CookieBanner() {
  // Treated as dismissed during SSR so the banner never flashes before hydration
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => true);
  if (dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-[1200px] mx-auto">
        <div role="region" aria-label="Storage notice" className="bg-[#fffef2] border border-[#e5e4db] rounded-xl p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
            <div className="flex-1">
              <p className="text-sm text-[#898981] leading-relaxed">
                Verora uses no cookies and no analytics. Your browser&apos;s local storage keeps your wallet connection and
                display preferences on this device so the app works between visits.{' '}
                <a href={siteConfig.links.privacy} className="text-[#191918] underline hover:no-underline">
                  Learn more
                </a>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={dismiss}>Got it</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
