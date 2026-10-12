'use client';

import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export type AgentLogoSize = 'sm' | 'md' | 'lg';

export interface AgentLogoProps {
  /** Agent display name, used for the monogram fallback */
  name: string;
  /** Logo URL from the agent metadata (hosted by the Verora API) */
  image?: string | null;
  size?: AgentLogoSize;
  className?: string;
}

const DEFAULT_SIZE = { px: 32, box: 'size-8 rounded-md', text: 'text-xs' };

const sizes = new Map<AgentLogoSize, { px: number; box: string; text: string }>([
  ['sm', { px: 20, box: 'size-5 rounded-md', text: 'text-[9px]' }],
  ['md', DEFAULT_SIZE],
  ['lg', { px: 40, box: 'size-10 rounded-lg', text: 'text-sm' }],
]);

/** First letters of the first two words, e.g. "Price Oracle" -> "PO" */
function monogram(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('');
  return (letters || '?').toUpperCase();
}

/** Only render absolute http(s) URLs; anything else falls back to the monogram */
function safeImageUrl(image: string | null | undefined): string | null {
  if (!image) return null;
  try {
    const url = new URL(image);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Decorative agent logo. The agent name is always rendered next to it, so it is hidden from
 * assistive tech. Falls back to a monogram when there is no image or it fails to load.
 */
export function AgentLogo({ name, image, size = 'md', className }: AgentLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = safeImageUrl(image);
  const showImage = src !== null && src !== failedSrc;
  const { px, box, text } = sizes.get(size) ?? DEFAULT_SIZE;

  return (
    <span
      aria-hidden
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden bg-[#f0efe6]',
        // Ring drawn on an overlay so it stays visible on top of the image
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-[#e5e4db]',
        box,
        className,
      )}
    >
      {showImage ? (
        <Image
          src={src}
          alt=""
          width={px}
          height={px}
          unoptimized
          onError={() => setFailedSrc(src)}
          className="size-full object-cover"
        />
      ) : (
        <span className={cn('select-none font-semibold leading-none text-[#6a6a65]', text)}>{monogram(name)}</span>
      )}
    </span>
  );
}
