'use client';

import { useIsClient } from '@/hooks/use-is-client';
import { useIsWrongNetwork } from '@/hooks/use-network';
import { useState, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { useAccount, useConnect, useWriteContract, usePublicClient } from 'wagmi';
import { maxUint256, type Hex, type Address } from 'viem';
import { foundry } from 'wagmi/chains';
import toast from 'react-hot-toast';
import { PageLayout } from '@/components/shared/page-layout';
import { AgentLogo } from '@/components/ui/agent-logo';
import { Button } from '@/components/ui/button';
import { STAKING_ABI, PAYMENT_ROUTER_ABI, QUERY_CONSUMER_ABI, CONTRACT_ADDRESSES } from '@/config/contracts';
import { targetChain } from '@/config/wagmi';
import { Wallet, ChevronRight } from 'lucide-react';
import { useFeeSplit, usePendingFees, useUserAllPositions } from '@/hooks/use-staking';
import { usePendingRefund, useUserQueries, QueryStatus, type QueryInfo } from '@/hooks/use-queries';
import { useAllAgents, type AgentMetadata } from '@/hooks/use-agents';
import { decodeText } from '@/lib/encryption';
import { cn, formatDateTime, formatEthAmount, formatRelativeTime, shortHex } from '@/lib/utils';
import {
  HashLink,
  KeyValueList,
  SectionLabel,
  Stat,
  StatStrip,
  StatusDot,
  UnderlineTabs,
  monoNumber,
  tableBodyRow,
  tableHeadRow,
  type StatusTone,
} from '@/components/ui/data-display';

// --- Helpers ---

/** Queries listed before the table is expanded */
const QUERY_PREVIEW_COUNT = 10;

/** Basis points to a whole-number percentage label */
const bpsToPercent = (bps: bigint | number) => `${Number(bps) / 100}%`;

const errorText = (error: Error) => error.message.split('\n')[0];

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? '' : 's'}`;

/** Compact table timestamp, e.g. "Oct 13, 11:21" */
const formatShortDateTime = (unixSeconds: bigint) =>
  new Date(Number(unixSeconds) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

const QUERY_STATUS_VIEW: Record<QueryStatus, { label: string; tone: StatusTone }> = {
  [QueryStatus.Pending]: { label: 'Waiting for agent', tone: 'warn' },
  [QueryStatus.InProgress]: { label: 'Settling', tone: 'warn' },
  [QueryStatus.Completed]: { label: 'Answered', tone: 'ok' },
  // A failed query has its payment returned to the requester
  [QueryStatus.Failed]: { label: 'Refunded', tone: 'error' },
};

const isOpenQuery = (q: QueryInfo) => q.status === QueryStatus.Pending || q.status === QueryStatus.InProgress;

/** Plaintext prompt of a query, or null when it is encrypted or not valid text */
function plaintextPrompt(q: QueryInfo): string | null {
  if (q.queryType === 'encrypted') return null;
  try {
    return decodeText(q.queryData);
  } catch {
    return null;
  }
}

// Column templates shared by each table's header, body and total rows
const queryCols = 'grid-cols-[minmax(0,1fr)_auto_auto_14px] md:grid-cols-[120px_minmax(0,1fr)_150px_100px_110px_20px] lg:grid-cols-[120px_minmax(0,1.4fr)_minmax(0,1fr)_90px_150px_100px_110px_20px]';
const stakeCols = 'grid-cols-[minmax(0,1fr)_auto_auto] md:grid-cols-[minmax(0,1fr)_140px_160px_140px_96px]';

const textLink = 'font-semibold underline decoration-[#c8c8c0] underline-offset-[3px] hover:decoration-[#191918]';

/** Single-line message shown in place of an empty or failed table */
function TableMessage({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#e5e4db] px-3 py-4 text-sm">
      <span className="text-[#6a6a65]">{children}</span>
      {action}
    </div>
  );
}

// --- Dashboard ---

export default function DashboardPage() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const [tab, setTab] = useState<'queries' | 'stakes'>('queries');
  const mounted = useIsClient();
  const [showAllQueries, setShowAllQueries] = useState(false);
  /** Position whose Unstake was clicked once and now awaits a second click to confirm */
  const [confirmUnstake, setConfirmUnstake] = useState<Hex | null>(null);

  const { writeContractAsync } = useWriteContract();
  const wrongNetwork = useIsWrongNetwork();
  const publicClient = usePublicClient();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // -- Chain-first hooks --
  const {
    data: positions,
    isLoading: stakingLoading,
    error: stakingError,
    refetch: refetchPositions,
  } = useUserAllPositions(address as Address | undefined);
  const { data: pendingFees, refetch: refetchFees } = usePendingFees(address as Address | undefined);
  const { data: feeSplit } = useFeeSplit();

  const {
    data: queries,
    isLoading: queriesLoading,
    error: queriesError,
  } = useUserQueries(address as Address | undefined);
  const { data: pendingRefund, refetch: refetchRefund } = usePendingRefund(address as Address | undefined);

  // Fetch all agents for name resolution and to find the agents this wallet owns
  const { data: allAgents, isLoading: agentsLoading } = useAllAgents();

  const agentMetadataMap = useMemo(() => {
    const map = new Map<string, AgentMetadata>();
    for (const agent of allAgents) {
      if (agent.metadata) map.set(agent.agentId.toLowerCase(), agent.metadata);
    }
    return map;
  }, [allAgents]);
  const agentName = (id: string) => agentMetadataMap.get(id.toLowerCase())?.name || `Agent ${shortHex(id, 8, 4)}`;
  const agentImage = (id: string) => agentMetadataMap.get(id.toLowerCase())?.image;

  const ownedAgents = useMemo(
    () => (address ? allAgents.filter(agent => agent.owner.toLowerCase() === address.toLowerCase()) : []),
    [allAgents, address],
  );

  // Derived staking summary
  const summary = useMemo(() => positions.reduce(
    (acc, p) => ({
      staked: acc.staked + p.amount,
      rewards: acc.rewards + p.pendingRewards,
      unbonding: acc.unbonding + p.unbondingAmount,
      withdrawable: acc.withdrawable + p.withdrawableAmount,
    }),
    { staked: 0n, rewards: 0n, unbonding: 0n, withdrawable: 0n },
  ), [positions]);

  const queryCounts = useMemo(() => ({
    completed: queries.filter(q => q.status === QueryStatus.Completed).length,
    open: queries.filter(isOpenQuery).length,
    failed: queries.filter(q => q.status === QueryStatus.Failed).length,
    // Failed queries are refunded, so they do not count towards what was spent
    spent: queries.reduce((sum, q) => (q.status === QueryStatus.Failed ? sum : sum + q.payment), 0n),
    escrow: queries.reduce((sum, q) => (isOpenQuery(q) ? sum + q.payment : sum), 0n),
    refunded: queries.reduce((sum, q) => (q.status === QueryStatus.Failed ? sum + q.payment : sum), 0n),
  }), [queries]);

  const hasPositions = positions.length > 0;
  const hasFees = !!pendingFees && pendingFees > 0n;
  const hasRefund = !!pendingRefund && pendingRefund > 0n;
  const claimable = positions.filter(p => p.pendingRewards > 0n);

  const handleConnect = () => { const i = connectors.find(c => c.id === 'injected'); if (i) connect({ connector: i }); };

  /** Sends one transaction and waits for it to be mined */
  const sendAndConfirm = async (send: () => Promise<Hex>) => {
    const hash = await send();
    const receipt = publicClient ? await publicClient.waitForTransactionReceipt({ hash }) : null;
    if (receipt && receipt.status !== 'success') throw new Error('Transaction reverted');
  };

  /** Runs wallet transactions keyed by `key`, then refreshes positions, fees and refunds */
  const runTx = async (key: string, execute: () => Promise<void>, successMessage: string) => {
    setBusyKey(key);
    try {
      await execute();
      toast.success(successMessage);
    } catch (e) {
      toast.error(e instanceof Error ? errorText(e) : 'Transaction failed');
    }
    void refetchPositions();
    void refetchFees();
    void refetchRefund();
    setBusyKey(null);
  };

  /** Claims every position with pending rewards, one transaction per agent */
  const handleClaimAll = () =>
    runTx('claim-all', async () => {
      for (const p of claimable) {
        await sendAndConfirm(() => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'claimRewards', args: [p.agentId] }));
      }
    }, claimable.length === 1 ? 'Rewards claimed' : `Rewards claimed from ${claimable.length} agents`);

  /** Starts unbonding the whole position; the max value unstakes every share, matching the agent page */
  const handleUnstake = (id: Hex) => {
    setConfirmUnstake(null);
    return runTx(`unstake-${id}`, () => sendAndConfirm(() => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'unstake', args: [id, maxUint256] })), 'Unbonding started');
  };

  const handleWithdrawStake = (id: Hex) =>
    runTx(`withdraw-${id}`, () => sendAndConfirm(() => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'withdraw', args: [id] })), 'Stake withdrawn');

  const handleWithdrawFees = () =>
    runTx('fees', () => sendAndConfirm(() => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.paymentRouter, abi: PAYMENT_ROUTER_ABI, functionName: 'withdrawFees' })), 'Fees withdrawn');

  const handleWithdrawRefund = () =>
    runTx('refund', () => sendAndConfirm(() => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.queryConsumer, abi: QUERY_CONSUMER_ABI, functionName: 'withdrawRefund' })), 'Refund withdrawn');

  const visibleQueries = showAllQueries ? queries : queries.slice(0, QUERY_PREVIEW_COUNT);
  const networkName = targetChain.id === foundry.id ? 'Local network' : targetChain.name;

  const header = (
    <>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-2xl font-bold leading-tight tracking-[-0.03em] text-[#191918]">Dashboard</h1>
          <p className="max-w-xl text-sm text-[#898981]">Your stakes, rewards and queries on Verora, read from the chain.</p>
        </div>
        {mounted && address && <HashLink value={address} explorer="address" />}
      </div>
      <p className="mb-8 text-sm text-[#6a6a65]">{networkName}, chain {targetChain.id}</p>
    </>
  );

  if (!mounted || !isConnected) {
    return (
      <PageLayout>
        <div className="pt-6 pb-24 md:pt-8">
          <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
            {header}
            <div className="bg-white border border-[#e5e4db] rounded-xl py-16 px-5 text-center">
              <Wallet className="w-6 h-6 text-[#c8c8c0] mx-auto mb-3" strokeWidth={1.5} aria-hidden />
              <h2 className="text-base font-semibold text-[#191918] mb-1">Connect your wallet</h2>
              <p className="text-sm text-[#898981] mb-1">Manage your staking positions and queries.</p>
              <p className="text-sm text-[#898981] mb-5">Use a browser wallet on {targetChain.name}.</p>
              <Button onClick={handleConnect}>Connect wallet</Button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  const loadingValue = <span className="text-[#a0a098]">...</span>;

  return (
    <PageLayout>
      <div className="pt-6 pb-24 md:pt-8">
        <div className="max-w-[1200px] mx-auto px-5 lg:px-10">
          {header}

          <StatStrip className="mb-10">
            <Stat
              label="Total staked"
              value={stakingLoading ? loadingValue : formatEthAmount(summary.staked)}
              unit="ETH"
              note={hasPositions
                ? `Across ${plural(positions.length, 'agent')}${summary.unbonding > 0n ? `, ${formatEthAmount(summary.unbonding)} unbonding` : ''}`
                : 'No stakes yet'}
            />
            <Stat
              label="Pending rewards"
              value={stakingLoading ? loadingValue : formatEthAmount(summary.rewards)}
              unit="ETH"
              note={summary.rewards > 0n ? 'Claimable now' : 'Nothing to claim yet'}
            />
            <Stat
              label="Queries sent"
              value={queriesLoading ? loadingValue : queries.length}
              note={queries.length > 0
                ? `${queryCounts.completed} answered · ${queryCounts.open} open · ${queryCounts.failed} failed`
                : 'Paid queries you send to agents'}
            />
            <Stat
              label="Spent on queries"
              value={queriesLoading ? loadingValue : formatEthAmount(queryCounts.spent)}
              unit="ETH"
              note={queryCounts.escrow > 0n || queryCounts.refunded > 0n
                ? [
                    queryCounts.escrow > 0n && `${formatEthAmount(queryCounts.escrow)} in escrow`,
                    queryCounts.refunded > 0n && `${formatEthAmount(queryCounts.refunded)} refunded`,
                  ].filter(Boolean).join(' · ')
                : 'Excludes refunds'}
              action={hasRefund && (
                <Button
                  type="button"
                  onClick={() => void handleWithdrawRefund()}
                  disabled={wrongNetwork || !!busyKey}
                  title="Refunds the contract could not send to your wallet automatically"
                  variant="link"
                  className="text-xs"
                >
                  {busyKey === 'refund' ? 'Withdrawing...' : `Withdraw ${formatEthAmount(pendingRefund)} ETH refund`}
                </Button>
              )}
            />
          </StatStrip>

          <UnderlineTabs
            label="Activity"
            tabs={[
              { value: 'queries' as const, label: 'Queries', count: queries.length },
              { value: 'stakes' as const, label: 'Stakes', count: positions.length },
            ]}
            active={tab}
            onChange={setTab}
            trailing={tab === 'stakes' && hasPositions && (
              <Button
                type="button"
                onClick={() => void handleClaimAll()}
                disabled={wrongNetwork || claimable.length === 0 || !!busyKey}
                size="sm"
              >
                {busyKey === 'claim-all' ? 'Claiming...' : 'Claim all rewards'}
              </Button>
            )}
          />

          {tab === 'queries' ? (
            <section aria-label="Your queries">
              {queriesLoading ? (
                <TableMessage>Loading your queries...</TableMessage>
              ) : queriesError ? (
                <TableMessage>Could not load your queries: {errorText(queriesError)}</TableMessage>
              ) : queries.length === 0 ? (
                <TableMessage action={<Link href="/agents" className={cn(textLink, 'text-sm')}>Browse agents</Link>}>
                  No queries yet. Open an agent and use its Query tab to send a paid question.
                </TableMessage>
              ) : (
                <>
                  <div role="table" aria-label="Your queries" className="text-sm">
                    <div role="row" className={cn(tableHeadRow, queryCols)}>
                      <span role="columnheader">Query</span>
                      <span role="columnheader" className="hidden md:block">Prompt</span>
                      <span role="columnheader" className="hidden lg:block">Agents</span>
                      <span role="columnheader" className="hidden lg:block">Type</span>
                      <span role="columnheader">Status</span>
                      <span role="columnheader" className="text-right">Payment</span>
                      <span role="columnheader" className="hidden text-right md:block">Created</span>
                      <span aria-hidden="true" />
                    </div>
                    {visibleQueries.map(q => {
                      const prompt = plaintextPrompt(q);
                      const status = QUERY_STATUS_VIEW[q.status] ?? { label: 'Unknown', tone: 'muted' as const };
                      const agents = q.assignedAgents.length === 0 ? 'None' : q.assignedAgents.map(agentName).join(', ');
                      return (
                        <Link
                          key={q.queryId}
                          href={`/queries/${q.queryId}`}
                          role="row"
                          aria-label={`Query ${shortHex(q.queryId)}, ${status.label}`}
                          className={cn(tableBodyRow, queryCols, 'focus-visible:bg-[#f6f5e9] focus-visible:outline-none')}
                        >
                          <span role="cell" title={q.queryId} className="font-mono text-[13px] underline decoration-[#c8c8c0] underline-offset-[3px]">
                            {shortHex(q.queryId)}
                          </span>
                          <span role="cell" className={cn('hidden min-w-0 truncate md:block', prompt === null && 'text-[#898981]')} title={prompt ?? undefined}>
                            {prompt ?? 'Encrypted prompt'}
                          </span>
                          <span role="cell" className="hidden min-w-0 truncate text-[13px] text-[#6a6a65] lg:block" title={agents}>{agents}</span>
                          <span role="cell" className="hidden text-[13px] text-[#6a6a65] lg:block">{q.queryType === 'encrypted' ? 'Encrypted' : 'Plaintext'}</span>
                          <span role="cell" className="min-w-0">
                            <StatusDot tone={status.tone}>
                              <span title={isOpenQuery(q) && q.deadline > 0n ? `Deadline ${formatRelativeTime(q.deadline)}` : undefined}>{status.label}</span>
                            </StatusDot>
                          </span>
                          <span role="cell" className={cn(monoNumber, 'text-right')}>{formatEthAmount(q.payment)} ETH</span>
                          <span role="cell" className="hidden text-right text-[13px] text-[#6a6a65] md:block">
                            <time dateTime={new Date(Number(q.createdAt) * 1000).toISOString()} title={formatDateTime(q.createdAt)}>
                              {formatShortDateTime(q.createdAt)}
                            </time>
                          </span>
                          <ChevronRight className="size-3.5 text-[#a0a098]" aria-hidden />
                        </Link>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-[13px] text-[#898981]">
                    {queries.length > QUERY_PREVIEW_COUNT ? (
                      <>
                        {showAllQueries ? `Showing all ${queries.length} queries` : `Showing latest ${QUERY_PREVIEW_COUNT} of ${queries.length} queries`}
                        {' · '}
                        <Button variant="link" onClick={() => setShowAllQueries(v => !v)}>
                          {showAllQueries ? 'Show latest' : 'Show all'}
                        </Button>
                      </>
                    ) : (
                      queries.length === 1 ? 'Showing 1 query' : `Showing all ${queries.length} queries`
                    )}
                  </p>
                </>
              )}
            </section>
          ) : (
            <section aria-label="Your stakes">
              {stakingLoading ? (
                <TableMessage>Loading your stakes...</TableMessage>
              ) : stakingError ? (
                <TableMessage action={<Button variant="link" onClick={() => void refetchPositions()} className="py-1.5">Try again</Button>}>
                  Could not load your positions: {errorText(stakingError)}
                </TableMessage>
              ) : !hasPositions ? (
                <TableMessage action={<Link href="/agents" className={cn(textLink, 'text-sm')}>Browse agents</Link>}>
                  No stakes yet. Stake ETH behind an agent to earn a share of its query fees.
                </TableMessage>
              ) : (
                <div role="table" aria-label="Your stakes" className="text-sm">
                  <div role="row" className={cn(tableHeadRow, stakeCols)}>
                    <span role="columnheader">Agent</span>
                    <span role="columnheader" className="text-right">Staked</span>
                    <span role="columnheader" className="hidden text-right md:block">Pending rewards</span>
                    <span role="columnheader" className="hidden text-right md:block">Unbonding</span>
                    <span aria-hidden="true" />
                  </div>
                  {positions.map(pos => {
                    const name = agentName(pos.agentId);
                    const unlocked = pos.withdrawableAmount > 0n;
                    const confirming = confirmUnstake === pos.agentId;
                    return (
                      <div key={pos.agentId} role="row" className={cn(tableBodyRow, stakeCols, 'py-2.5')}>
                        <span role="cell" className="flex min-w-0 items-center gap-2.5">
                          <AgentLogo name={name} image={agentImage(pos.agentId)} size="sm" />
                          <Link href={`/agents/${pos.agentId}`} className="min-w-0 truncate font-semibold text-[#191918] hover:underline">{name}</Link>
                        </span>
                        <span role="cell" className={cn(monoNumber, 'text-right')}>{formatEthAmount(pos.amount)} ETH</span>
                        <span role="cell" className={cn(monoNumber, 'hidden text-right md:block')}>{formatEthAmount(pos.pendingRewards)} ETH</span>
                        <span role="cell" className="hidden text-right md:block">
                          {pos.unbondingAmount === 0n && !unlocked ? (
                            <span className="text-[13px] text-[#a0a098]">-</span>
                          ) : (
                            <>
                              <span className={monoNumber}>{formatEthAmount(pos.unbondingAmount)} ETH</span>
                              <span className="block text-xs text-[#898981]">
                                {unlocked
                                  ? `${formatEthAmount(pos.withdrawableAmount)} ready`
                                  : pos.nextUnlockTime > 0n
                                    ? <span title={formatDateTime(pos.nextUnlockTime)}>unlocks {formatRelativeTime(pos.nextUnlockTime)}</span>
                                    : null}
                              </span>
                            </>
                          )}
                        </span>
                        <span role="cell" className="flex flex-col items-end">
                          {unlocked && (
                            <Button
                              type="button"
                              onClick={() => void handleWithdrawStake(pos.agentId)}
                              disabled={wrongNetwork || !!busyKey}
                              aria-label={`Withdraw ${formatEthAmount(pos.withdrawableAmount)} ETH of unlocked stake from ${name}`}
                              variant="link"
                              className="py-1.5"
                            >
                              {busyKey === `withdraw-${pos.agentId}` ? 'Withdrawing...' : 'Withdraw'}
                            </Button>
                          )}
                          {pos.amount > 0n && (
                            <Button
                              type="button"
                              onClick={() => (confirming ? void handleUnstake(pos.agentId) : setConfirmUnstake(pos.agentId))}
                              onBlur={() => { if (confirming) setConfirmUnstake(null); }}
                              disabled={wrongNetwork || !!busyKey}
                              aria-label={confirming
                                ? `Confirm unstaking all ${formatEthAmount(pos.amount)} ETH from ${name}`
                                : `Unstake from ${name}`}
                              title={confirming ? 'Unstaked ETH unbonds before it can be withdrawn and stays slashable until then' : undefined}
                              variant="link"
                              className={cn('py-1.5', confirming && 'font-semibold text-[#9a2f1a] decoration-[#9a2f1a] hover:text-[#9a2f1a] hover:decoration-[#9a2f1a]')}
                            >
                              {busyKey === `unstake-${pos.agentId}` ? 'Unstaking...' : confirming ? 'Confirm' : 'Unstake'}
                            </Button>
                          )}
                          {pos.amount === 0n && !unlocked && <span className="text-[13px] text-[#a0a098]">-</span>}
                        </span>
                      </div>
                    );
                  })}
                  <div role="row" className={cn('grid gap-4 p-3 text-[13px] font-semibold', stakeCols)}>
                    <span role="cell">Total</span>
                    <span role="cell" className="text-right font-mono tabular-nums">{formatEthAmount(summary.staked)} ETH</span>
                    <span role="cell" className="hidden text-right font-mono tabular-nums md:block">{formatEthAmount(summary.rewards)} ETH</span>
                    <span aria-hidden="true" className="hidden md:block" />
                    <span aria-hidden="true" />
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="mt-14 grid grid-cols-1 gap-12 md:grid-cols-2">
            <section aria-labelledby="your-agents-heading">
              <SectionLabel id="your-agents-heading">Your agents</SectionLabel>
              <div className="border-t border-[#e5e4db] text-sm">
                {agentsLoading ? (
                  <p className="border-b border-[#e5e4db] py-3 text-[#6a6a65]">Loading agents...</p>
                ) : ownedAgents.length === 0 ? (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[#e5e4db] py-3">
                    <span className="text-[#6a6a65]">This wallet doesn&apos;t own an agent yet.</span>
                    <Link href="/agents/register" className={textLink}>Register an agent</Link>
                  </div>
                ) : (
                  ownedAgents.map(agent => (
                    <Link
                      key={agent.agentId}
                      href={`/agents/${agent.agentId}`}
                      className="flex items-center justify-between gap-4 border-b border-[#efeee5] py-2.5 transition-colors hover:bg-[#f6f5e9]"
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <AgentLogo name={agentName(agent.agentId)} image={agent.metadata?.image} size="sm" />
                        <span className="min-w-0 truncate font-semibold">{agentName(agent.agentId)}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-3">
                        <span className={cn(monoNumber, 'text-[#6a6a65]')}>{formatEthAmount(agent.totalStake)} ETH staked</span>
                        <ChevronRight className="size-3.5 text-[#a0a098]" aria-hidden />
                      </span>
                    </Link>
                  ))
                )}
                {hasFees && (
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[#efeee5] py-2.5">
                    <span className="text-[#6a6a65]">
                      Agent fees to withdraw <span className={cn(monoNumber, 'ml-1.5 text-[#191918]')}>{formatEthAmount(pendingFees)} ETH</span>
                    </span>
                    <Button variant="link" onClick={() => void handleWithdrawFees()} disabled={wrongNetwork || !!busyKey} className="py-1.5">
                      {busyKey === 'fees' ? 'Withdrawing...' : 'Withdraw'}
                    </Button>
                  </div>
                )}
              </div>
            </section>
            <section aria-labelledby="fee-split-heading">
              <SectionLabel id="fee-split-heading">Fee split per query</SectionLabel>
              <KeyValueList>
                {[
                  { label: 'Agents that answered', bps: feeSplit?.agentFee },
                  { label: 'Their stakers', bps: feeSplit?.stakerFee },
                  { label: 'Protocol treasury', bps: feeSplit?.platformFee },
                ].map(row => (
                  <div key={row.label} className="flex justify-between gap-3 border-b border-[#efeee5] py-2.5">
                    <dt>{row.label}</dt>
                    <dd className="m-0 font-mono text-[13px]">{row.bps === undefined ? '-' : bpsToPercent(row.bps)}</dd>
                  </div>
                ))}
              </KeyValueList>
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
