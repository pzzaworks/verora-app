import Link from 'next/link';
import type { ReactNode } from 'react';
import { targetChain } from '@/config/wagmi';
import { cn, shortHex } from '@/lib/utils';

/*
 * Building blocks for the dense, table-first layout used by the agents, dashboard and
 * query pages: hairline rules, mono numbers and underline tabs instead of cards.
 */

export const monoNumber = 'font-mono text-[13px] tabular-nums';

/** Small uppercase heading that sits above a table or key-value list */
export function SectionLabel({ id, children, className }: { id?: string; children: ReactNode; className?: string }) {
  return (
    <h2 id={id} className={cn('mb-2 text-xs font-normal uppercase tracking-[0.06em] text-[#898981]', className)}>
      {children}
    </h2>
  );
}

export type StatusTone = 'ok' | 'warn' | 'error' | 'muted';

function dotTone(tone: StatusTone): string {
  switch (tone) {
    case 'ok':
      return 'bg-[#3d8b3e]';
    case 'warn':
      return 'bg-[#c99a2e]';
    case 'error':
      return 'bg-[#c2412b]';
    case 'muted':
      return 'bg-[#c8c8c0]';
  }
}

/** Coloured dot followed by a plain-text label */
export function StatusDot({ tone, children, className }: { tone: StatusTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2 text-[13px]', tone === 'error' && 'text-[#9a2f1a]', className)}>
      <span aria-hidden="true" className={cn('size-[7px] shrink-0 rounded-full', dotTone(tone))} />
      {children}
    </span>
  );
}

interface UnderlineTab<T extends string> {
  value: T;
  label: string;
  count?: number | string;
}

/** Text tabs with an underline on the active one, laid on a hairline */
export function UnderlineTabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
  trailing,
}: {
  tabs: UnderlineTab<T>[];
  active: T;
  onChange: (value: T) => void;
  label: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e4db]">
      <div role="tablist" aria-label={label} className="flex gap-6">
        {tabs.map((tab) => {
          const selected = tab.value === active;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(tab.value)}
              className={cn(
                '-mb-px cursor-pointer border-b-2 py-3 text-sm transition-colors',
                selected
                  ? 'border-[#191918] font-semibold text-[#191918]'
                  : 'border-transparent text-[#6a6a65] hover:text-[#191918]',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-1.5 font-mono text-xs font-normal text-[#898981]">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

/** Two-column label/value sheet with hairlines between rows */
export function KeyValueList({ children, columns = 1, className }: { children: ReactNode; columns?: 1 | 2; className?: string }) {
  return (
    <dl
      className={cn(
        'm-0 grid border-t border-[#e5e4db] text-sm',
        columns === 2 ? 'grid-cols-1 md:grid-cols-2 md:gap-x-12' : 'grid-cols-1',
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function KeyValueRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] items-baseline gap-4 border-b border-[#efeee5] py-[11px] sm:grid-cols-[160px_minmax(0,1fr)]">
      <dt className="text-[#898981]">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

/** Secondary text that trails a value, e.g. "8 of 8 answered" */
export function Muted({ children }: { children: ReactNode }) {
  return <span className="ml-1.5 text-[#898981]">{children}</span>;
}

/** Row of headline numbers separated by vertical hairlines */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'm-0 grid grid-cols-2 gap-x-6 divide-[#e5e4db] border-y border-[#e5e4db] lg:grid-cols-4 lg:gap-x-0 lg:divide-x',
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function Stat({ label, value, unit, note, action }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 py-4 lg:px-5 lg:first:pl-0">
      <dt className="text-xs uppercase tracking-[0.06em] text-[#898981]">{label}</dt>
      <dd className="m-0 flex items-baseline gap-1.5 font-mono text-xl tabular-nums">
        {value}
        {unit && <span className="text-xs text-[#898981]">{unit}</span>}
      </dd>
      {(note || action) && (
        <dd className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#898981]">
          {note}
          {action}
        </dd>
      )}
    </div>
  );
}

const linkClass =
  'font-mono text-[13px] text-[#191918] underline decoration-[#c8c8c0] underline-offset-[3px] hover:decoration-[#191918]';

type ExplorerKind = 'address' | 'tx';

/** Block explorer URL on the target chain, or undefined on chains without one (local Anvil) */
export function explorerUrl(kind: ExplorerKind, value: string): string | undefined {
  const base = targetChain.blockExplorers?.default.url;
  return base ? `${base}/${kind}/${value}` : undefined;
}

/**
 * Shortened hash or address shown as 0x1234...abcd with the full value on hover.
 * Links in-app when `href` is given, to the block explorer when `explorer` is given,
 * and falls back to plain text when neither resolves.
 */
export function HashLink({ value, href, explorer, className }: { value: string; href?: string; explorer?: ExplorerKind; className?: string }) {
  const label = shortHex(value);
  if (href) {
    return (
      <Link href={href} title={value} className={cn(linkClass, className)}>
        {label}
      </Link>
    );
  }
  const external = explorer ? explorerUrl(explorer, value) : undefined;
  if (external) {
    return (
      <a href={external} target="_blank" rel="noopener noreferrer" title={value} className={cn(linkClass, className)}>
        {label}
      </a>
    );
  }
  return (
    <span title={value} className={cn('font-mono text-[13px]', className)}>
      {label}
    </span>
  );
}

/** Classes shared by grid-based table rows so header and body columns line up */
export const tableHeadRow =
  'grid gap-4 border-b border-[#e5e4db] px-3 py-3 text-xs uppercase tracking-[0.06em] text-[#898981]';
export const tableBodyRow =
  'grid items-center gap-4 border-b border-[#efeee5] px-3 py-3 text-sm text-[#191918] transition-colors hover:bg-[#f6f5e9]';
