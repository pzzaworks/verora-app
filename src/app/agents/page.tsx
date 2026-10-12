'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageLayout } from '@/components/shared/page-layout';
import { Button } from '@/components/ui/button';
import { AgentLogo } from '@/components/ui/agent-logo';
import { Loader2, Search, Shield, X, ChevronRight, Activity } from 'lucide-react';
import {
  StatusDot,
  UnderlineTabs,
  monoNumber,
  tableBodyRow,
  tableHeadRow,
  type StatusTone,
} from '@/components/ui/data-display';
import { useAllAgents, useNetworkStats, type Agent } from '@/hooks/use-agents';
import { cn, formatEthAmount } from '@/lib/utils';

function formatCount(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

const plural = (count: number, singular: string, pluralForm: string) => `${formatCount(count)} ${count === 1 ? singular : pluralForm}`;

type StatusFilter = 'all' | 'online' | 'unreachable';
type SortKey = 'name' | 'success' | 'answered' | 'stake';
/** 1 = ascending, -1 = descending */
type SortDir = 1 | -1;

/** Column name used in the "Sorted by ..." note */
function sortLabel(key: SortKey): string {
  return key === 'success' ? 'success rate' : key;
}

/**
 * Column templates per breakpoint. Phones show agent, stake and chevron (status moves under
 * the name), sm adds success, md adds status and answered, lg adds capabilities.
 */
const gridCols =
  'grid-cols-[minmax(0,1fr)_96px_14px] sm:grid-cols-[minmax(0,1fr)_64px_104px_14px] md:grid-cols-[minmax(0,1fr)_120px_64px_96px_104px_14px] lg:grid-cols-[minmax(0,2.6fr)_minmax(0,1.7fr)_120px_84px_96px_112px_20px]';

/** Availability label and tone: lifecycle status first, then the API's latest health check */
function availability(agent: Agent): { label: string; tone: StatusTone } {
  if (agent.status !== 'active') {
    return { label: agent.status[0].toUpperCase() + agent.status.slice(1), tone: 'error' };
  }
  if (agent.healthStatus === 'healthy') return { label: 'Online', tone: 'ok' };
  if (agent.healthStatus === 'unhealthy') return { label: 'Unreachable', tone: 'error' };
  return { label: 'Not checked yet', tone: 'muted' };
}

/** Online = active and passing the latest endpoint health check */
const isOnline = (agent: Agent) => agent.status === 'active' && agent.healthStatus === 'healthy';
/** Unreachable = failed the health check or no longer active; never-checked agents belong to neither tab */
const isUnreachable = (agent: Agent) => agent.status !== 'active' || agent.healthStatus === 'unhealthy';

/** Share of assigned queries answered, or null when the agent has not been assigned any */
function successRate(agent: Agent): number | null {
  return agent.totalQueries > 0 ? agent.successfulQueries / agent.totalQueries : null;
}

function agentName(agent: Agent): string {
  return agent.metadata?.name || `Agent ${agent.agentId.slice(0, 8)}...`;
}

function compareAgents(a: Agent, b: Agent, key: SortKey): number {
  switch (key) {
    case 'name':
      return agentName(a).localeCompare(agentName(b), 'en', { sensitivity: 'base' });
    case 'success':
      return (successRate(a) ?? -1) - (successRate(b) ?? -1);
    case 'answered':
      return a.successfulQueries - b.successfulQueries;
    case 'stake':
      return a.totalStake === b.totalStake ? 0 : a.totalStake < b.totalStake ? -1 : 1;
  }
}

function SortHeader({
  column,
  label,
  sortKey,
  sortDir,
  onSort,
  className,
}: {
  column: SortKey;
  label: string;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = column === sortKey;
  return (
    <span
      role="columnheader"
      aria-sort={active ? (sortDir < 0 ? 'descending' : 'ascending') : 'none'}
      className={className}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="cursor-pointer uppercase tracking-[inherit] hover:text-[#191918]"
      >
        {label}
        {active && <span aria-hidden> {sortDir < 0 ? '↓' : '↑'}</span>}
      </button>
    </span>
  );
}

export default function AgentsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('stake');
  const [sortDir, setSortDir] = useState<SortDir>(-1);

  const { data: agents, isLoading, error, refetch } = useAllAgents();
  const { data: networkStats } = useNetworkStats();

  // Client-side search over name, description and capabilities
  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(agent => {
      const name = agent.metadata?.name?.toLowerCase() || '';
      const desc = agent.metadata?.description?.toLowerCase() || '';
      return name.includes(q) || desc.includes(q) || agent.capabilities.some(cap => cap.toLowerCase().includes(q));
    });
  }, [agents, searchQuery]);

  // Status tab filter, then the active sort
  const visibleAgents = useMemo(() => {
    const rows = filteredAgents.filter(agent =>
      statusFilter === 'all' ? true : statusFilter === 'online' ? isOnline(agent) : isUnreachable(agent),
    );
    return rows.sort((a, b) => compareAgents(a, b, sortKey) * sortDir);
  }, [filteredAgents, statusFilter, sortKey, sortDir]);

  const tabs = useMemo(
    () => [
      { value: 'all' as const, label: 'All', count: filteredAgents.length },
      { value: 'online' as const, label: 'Online', count: filteredAgents.filter(isOnline).length },
      { value: 'unreachable' as const, label: 'Unreachable', count: filteredAgents.filter(isUnreachable).length },
    ],
    [filteredAgents],
  );

  // Clicking the active column flips direction; a new column starts high to low (names A to Z)
  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(dir => (dir === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 1 : -1);
    }
  };

  const totalAgents = agents.length;

  const errorMessage = error ? (error instanceof Error ? error.message : 'Failed to load agents') : null;

  return (
    <PageLayout>
      <div className="py-6 md:py-8">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-2">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.03em] text-[#191918] leading-tight mb-1">
                Agent Registry
              </h1>
              <p className="text-sm text-[#898981] max-w-xl">
                AI agents registered on-chain. Each one is backed by stake and scored by its query history.
              </p>
            </div>
            <div className="relative w-full md:w-72" role="search">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#a0a098]" aria-hidden />
              <input
                type="search"
                aria-label="Search agents by name, description or capability"
                placeholder="Search agents or capabilities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-9 py-2.5 bg-white border border-[#e5e4db] rounded-xl text-sm text-[#191918] placeholder:text-[#a0a098] focus:outline-none focus:border-[#c8c8c0] focus:ring-1 focus:ring-[#e5e4db] transition-all [&::-webkit-search-cancel-button]:hidden"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2"
                >
                  <X className="size-3.5" aria-hidden />
                </Button>
              )}
            </div>
          </div>

          {/* Stats line */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6a6a65] mb-8" aria-live="polite">
            {searchQuery ? (
              <span>{filteredAgents.length} result{filteredAgents.length !== 1 ? 's' : ''} found</span>
            ) : (
              <>
                <span>{totalAgents} agents</span>
                {networkStats && (
                  <>
                    <span aria-hidden>·</span>
                    <span>{formatCount(networkStats.activeAgents)} active</span>
                    <span aria-hidden>·</span>
                    <span>{plural(networkStats.completedQueries, 'query', 'queries')} answered</span>
                    <span aria-hidden>·</span>
                    <span>{formatEthAmount(BigInt(networkStats.totalVolume))} ETH in query payments</span>
                  </>
                )}
              </>
            )}
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-24 gap-4" role="status">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-[#f0efe6]" />
                <Loader2 className="w-5 h-5 animate-spin text-[#c8c8c0] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-sm text-[#6a6a65]">Loading agents from the network...</p>
            </div>
          )}

          {/* Error */}
          {errorMessage && (
            <div className="text-center py-24" role="alert">
              <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <Activity className="w-5 h-5 text-red-400" />
              </div>
              <p className="text-sm text-[#191918] font-medium mb-1">Could not load agents</p>
              <p className="text-sm text-[#6a6a65] mb-5">{errorMessage}</p>
              <Button variant="tonal" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          )}

          {/* Empty - no agents */}
          {!isLoading && !errorMessage && agents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-14 h-14 rounded-2xl bg-[#f0efe6] flex items-center justify-center mb-4 rotate-6">
                <Shield className="w-6 h-6 text-[#898981] -rotate-6" />
              </div>
              <p className="text-sm text-[#191918] font-semibold mb-1">No agents registered yet</p>
              <p className="text-sm text-[#6a6a65] mb-6">Be the first to deploy an agent on the network.</p>
              <Button onClick={() => router.push('/agents/register')}>
                Register agent
              </Button>
            </div>
          )}

          {/* Empty - search no results */}
          {!isLoading && !errorMessage && agents.length > 0 && filteredAgents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24">
              <div className="w-14 h-14 rounded-2xl bg-[#f0efe6] flex items-center justify-center mb-4 -rotate-3">
                <Search className="w-6 h-6 text-[#898981] rotate-3" />
              </div>
              <p className="text-sm text-[#191918] font-semibold mb-1">No agents match your search</p>
              <p className="text-sm text-[#6a6a65] mb-5">Try a different name or capability, or clear your search.</p>
              <Button variant="tonal" onClick={() => setSearchQuery('')}>
                Clear search
              </Button>
            </div>
          )}

          {/* Status tabs + agent table */}
          {!isLoading && !errorMessage && filteredAgents.length > 0 && (
            <>
              <UnderlineTabs
                tabs={tabs}
                active={statusFilter}
                onChange={setStatusFilter}
                label="Filter by status"
                trailing={
                  <span className="text-[13px] text-[#898981]">
                    Sorted by {sortLabel(sortKey)}, {sortDir < 0 ? 'high to low' : 'low to high'}
                  </span>
                }
              />

              <div role="table" aria-label="Agents" className="text-sm">
                <div role="row" className={cn(tableHeadRow, gridCols)}>
                  <SortHeader column="name" label="Agent" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                  <span role="columnheader" className="hidden lg:block">Capabilities</span>
                  <span role="columnheader" className="hidden md:block">Status</span>
                  <SortHeader column="success" label="Success" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="hidden sm:block text-right" />
                  <SortHeader column="answered" label="Answered" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="hidden md:block text-right" />
                  <SortHeader column="stake" label="Staked" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="text-right" />
                  <span aria-hidden />
                </div>

                {visibleAgents.map((agent) => {
                  const state = availability(agent);
                  const rate = successRate(agent);
                  const capabilities = agent.capabilities.join(', ');

                  return (
                    <Link
                      key={agent.agentId}
                      href={`/agents/${agent.agentId}`}
                      role="row"
                      className={cn(tableBodyRow, gridCols)}
                    >
                      <span role="cell" className="flex min-w-0 items-center gap-3">
                        <AgentLogo name={agentName(agent)} image={agent.metadata?.image} size="md" />
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="truncate font-semibold">{agentName(agent)}</span>
                          <span className="truncate text-xs text-[#898981]">
                            {agent.metadata?.description || 'No description published.'}
                          </span>
                          <StatusDot tone={state.tone} className="mt-1 text-xs md:hidden">{state.label}</StatusDot>
                        </span>
                      </span>
                      <span role="cell" title={capabilities || undefined} className="hidden min-w-0 truncate font-mono text-xs text-[#6a6a65] lg:block">
                        {capabilities || '-'}
                      </span>
                      <span role="cell" className="hidden md:block">
                        <StatusDot tone={state.tone}>{state.label}</StatusDot>
                      </span>
                      <span
                        role="cell"
                        className={cn(
                          monoNumber,
                          'hidden text-right sm:block',
                          rate === null ? 'text-[#a0a098]' : rate < 0.5 && 'text-[#9a2f1a]',
                        )}
                      >
                        {rate === null ? '-' : `${Math.round(rate * 100)}%`}
                      </span>
                      <span role="cell" className={cn(monoNumber, 'hidden text-right md:block')}>
                        {agent.successfulQueries} / {agent.totalQueries}
                      </span>
                      <span role="cell" className={cn(monoNumber, 'text-right')}>
                        {agent.totalStake === 0n ? '-' : `${formatEthAmount(agent.totalStake)} ETH`}
                      </span>
                      <ChevronRight className="size-3.5 text-[#a0a098]" aria-hidden />
                    </Link>
                  );
                })}

                {visibleAgents.length === 0 && (
                  <p className="border-b border-[#efeee5] px-3 py-10 text-center text-sm text-[#6a6a65]">
                    {statusFilter === 'online' ? 'No agents are online right now.' : 'No unreachable agents.'}
                  </p>
                )}
              </div>

              <p className="mt-4 text-[13px] text-[#898981]" aria-live="polite">
                Showing {visibleAgents.length} of {totalAgents} agents
              </p>
            </>
          )}

        </div>
      </div>
    </PageLayout>
  );
}
