import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Compact ETH display for wei amounts: "0", "< 0.001", or three decimals */
export function formatEthAmount(wei: bigint): string {
  if (wei === 0n) return '0';
  const value = Number(wei) / 1e18;
  if (value < 0.001) return '< 0.001';
  return value.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

/** Relative time from now for a unix timestamp in seconds: "just now", "5m ago", "in 3d" */
export function formatRelativeTime(unixSeconds: bigint | number): string {
  const diffMs = Number(unixSeconds) * 1000 - Date.now();
  const abs = Math.abs(diffMs);
  const minutes = Math.floor(abs / 60_000);
  const hours = Math.floor(abs / 3_600_000);
  const days = Math.floor(abs / 86_400_000);
  if (minutes < 1) return 'just now';
  const span = minutes < 60 ? `${minutes}m` : hours < 24 ? `${hours}h` : `${days}d`;
  return diffMs > 0 ? `in ${span}` : `${span} ago`;
}

/** Full local date and time for a unix timestamp in seconds, for tooltips and detail rows */
export function formatDateTime(unixSeconds: bigint | number): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Shortened hex string such as an address, ID or hash: 0x1234...abcd */
export function shortHex(value: string, head = 6, tail = 4): string {
  return value.length <= head + tail + 3 ? value : `${value.slice(0, head)}...${value.slice(-tail)}`;
}
