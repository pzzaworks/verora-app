import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'tonal' | 'ghost' | 'danger' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Square icon-only button; pair with an aria-label */
  icon?: boolean;
  isLoading?: boolean;
}

/*
 * One radius, three heights (28 / 32 / 36), tight horizontal padding. Primary (yellow) is
 * reserved for the single main action on a screen. `link` is the inline text action used in tables.
 */
const BASE =
  'inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-transparent font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191918] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#f0efe6] disabled:text-[#a0a098]';

function variantClass(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return 'bg-[#f8dc92] text-[#191918] hover:bg-[#e5c97f]';
    case 'secondary':
      return 'border-[#e5e4db] bg-white text-[#191918] hover:border-[#c8c8c0] hover:bg-[#fafaf8]';
    case 'tonal':
      return 'bg-[#f0efe6] text-[#191918] hover:bg-[#e5e4db]';
    case 'ghost':
      return 'bg-transparent text-[#6a6a65] hover:bg-[#f0efe6] hover:text-[#191918]';
    case 'danger':
      return 'border-[#e8c4bb] bg-transparent text-[#9a2f1a] hover:bg-[#fbe7e2]';
    case 'link':
      return '';
  }
}

function sizeClass(size: ButtonSize, icon: boolean): string {
  switch (size) {
    case 'sm':
      return icon ? 'size-7 text-[13px]' : 'h-7 px-2.5 text-[13px]';
    case 'md':
      return icon ? 'size-8 text-[13px]' : 'h-8 px-3 text-[13px]';
    case 'lg':
      return icon ? 'size-9 text-sm' : 'h-9 px-3.5 text-sm';
  }
}

const LINK =
  'inline-flex cursor-pointer items-center gap-1.5 bg-transparent p-0 text-[13px] text-[#6a6a65] underline decoration-[#c8c8c0] underline-offset-[3px] transition-colors hover:text-[#191918] hover:decoration-[#191918] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191918] disabled:cursor-not-allowed disabled:opacity-50';

/** Class string for anything that should look like a button, e.g. a Next `Link` */
export function buttonClass({
  variant = 'primary',
  size = 'md',
  icon = false,
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; icon?: boolean; className?: string } = {}): string {
  if (variant === 'link') return cn(LINK, className);
  return cn(BASE, variantClass(variant), sizeClass(size, icon), className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', icon = false, isLoading, disabled, type = 'button', children, ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={buttonClass({ variant, size, icon, className })}
      {...props}
    >
      {isLoading && (
        <svg className="size-[13px] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" />
        </svg>
      )}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
