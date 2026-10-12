'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/** True after hydration on the client; false during SSR. Used to render wallet-dependent UI safely. */
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
