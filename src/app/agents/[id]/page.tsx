'use client';

import { useIsClient } from '@/hooks/use-is-client';
import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, useConnect, useBalance, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther, maxUint256, type Hex } from 'viem';
import toast from 'react-hot-toast';
import { ChevronRight, Loader2 } from 'lucide-react';
import { PageLayout } from '@/components/shared/page-layout';
import { Button } from '@/components/ui/button';
import { AgentLogo } from '@/components/ui/agent-logo';
import {
  HashLink,
  KeyValueList,
  KeyValueRow,
  Muted,
  SectionLabel,
  StatusDot,
  UnderlineTabs,
  monoNumber,
  tableBodyRow,
  tableHeadRow,
  type StatusTone,
} from '@/components/ui/data-display';
import { STAKING_ABI, CONTRACT_ADDRESSES } from '@/config/contracts';
import { targetChain } from '@/config/wagmi';
import { useIsWrongNetwork } from '@/hooks/use-network';
import { useAgent } from '@/hooks/use-agents';
import { useAgentStakingStats, useFeeSplit, useStakingParams, useUserPosition } from '@/hooks/use-staking';
import {
  QueryStatus,
  useAgentQueries,
  useEncryptionKey,
  useMinPaymentPerAgent,
  useQueryInfo,
  useQueryResponses,
  useSubmitQuery,
} from '@/hooks/use-queries';
import type { ApiQuery } from '@/lib/api';
import { decodeText, isValidPublicKey, readAnswer } from '@/lib/encryption';
import { cn, formatDateTime, formatEthAmount, formatRelativeTime } from '@/lib/utils';

const QUERY_TTL_SECONDS = 10 * 60;
const QUERY_PAGE_SIZE = 20;
const MAX_BPS = 10_000;
/** ETH left in the wallet for gas when staking the maximum */
const GAS_RESERVE = parseEther('0.01');
/** Agent IDs are bytes32 values */
const AGENT_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function formatEth(value: string) {
  const num = parseFloat(value);
  if (num === 0) return '0';
  if (num < 0.001) return '< 0.001';
  return num.toFixed(3);
}

function formatDuration(seconds: bigint) {
  const total = Number(seconds);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;
  if (total >= 86_400) return plural(Number((total / 86_400).toFixed(1)), 'day');
  if (total >= 3_600) return plural(Math.round(total / 3_600), 'hour');
  if (total >= 60) return plural(Math.round(total / 60), 'minute');
  return plural(total, 'second');
}

const bpsToPercent = (bps: bigint) => `${Number(((Number(bps) / MAX_BPS) * 100).toFixed(2))}%`;

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const isAmount = (value: string) => value.trim() !== '' && /^\d*\.?\d*$/.test(value.trim()) && parseFloat(value) > 0;

/** Month, day and 24h time, matching the compact timestamps in tables */
const formatShortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

const QUERY_STATUS: Record<ApiQuery['status'], { tone: StatusTone; label: string }> = {
  pending: { tone: 'warn', label: 'Pending' },
  in_progress: { tone: 'warn', label: 'Settling' },
  completed: { tone: 'ok', label: 'Completed' },
  failed: { tone: 'error', label: 'Failed' },
};

/** Readable prompt of a plaintext query; null for encrypted or undecodable data */
function promptPreview(query: ApiQuery): string | null {
  if (query.queryType === 'encrypted') return null;
  try {
    const text = decodeText(query.queryData).trim();
    return text || null;
  } catch {
    return null;
  }
}

/* Local presentation pieces for the compact label/field forms in the Send query and Stake tabs */
const formGrid =
  'grid max-w-[640px] grid-cols-1 items-start gap-x-6 gap-y-2 pt-6 text-sm sm:grid-cols-[160px_minmax(0,1fr)] sm:gap-y-4';
const fieldLabel = 'mt-2 text-[#898981] first:mt-0 sm:mt-0';
const inputLabel = cn(fieldLabel, 'sm:pt-[10px]');
const hintText = 'text-xs text-[#898981]';
const textLink = 'font-mono text-[13px] text-[#191918] underline decoration-[#c8c8c0] underline-offset-[3px] hover:decoration-[#191918]';

/** Text input with a trailing ETH unit, optionally followed by an inline action */
function EthInput({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
  ariaLabel,
  action,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  describedBy?: string;
  ariaLabel?: string;
  action?: ReactNode;
}) {
  return (
    <span className="flex max-w-[240px] items-center gap-2 rounded-xl border border-[#e5e4db] bg-white px-3 focus-within:border-[#898981]">
      <input
        id={id}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        value={value}
        onChange={(e) => /^\d*\.?\d*$/.test(e.target.value) && onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-auto border-0 bg-transparent py-[10px] font-mono text-sm text-[#191918] outline-none"
      />
      <span className="text-[13px] text-[#898981]">ETH</span>
      {action}
    </span>
  );
}

type AgentTab = 'queries' | 'query' | 'stake';

export default function AgentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const agentId = AGENT_ID_PATTERN.test(rawId) ? (rawId.toLowerCase() as Hex) : undefined;

  const [activeTab, setActiveTab] = useState<AgentTab>('queries');
  const mounted = useIsClient();
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();
  const { data: balanceData } = useBalance({ address });
  const walletBalance = balanceData ? formatEther(balanceData.value) : '0';
  const { writeContractAsync } = useWriteContract();
  const wrongNetwork = useIsWrongNetwork();
  const publicClient = usePublicClient();

  const { data: agent, isLoading, error: agentError, refetch: refetchAgent } = useAgent(agentId);
  const { data: stakingStats } = useAgentStakingStats(agentId);
  const { data: position, refetch: refetchPosition } = useUserPosition(agentId, address);
  const { minimumStake, unstakingPeriod } = useStakingParams();
  const { data: feeSplit } = useFeeSplit();
  const { data: agentQueries, isLoading: queriesLoading, error: queriesError } = useAgentQueries(agentId, QUERY_PAGE_SIZE);

  // Staking form
  const [stakingMode, setStakingMode] = useState<'stake' | 'unstake'>('stake');
  const [amount, setAmount] = useState('');
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  // Query form
  const [prompt, setPrompt] = useState('');
  const [queryPaymentInput, setQueryPayment] = useState<string | null>(null);
  const [encryptQueryEnabled, setEncryptQueryEnabled] = useState(true);
  const [activeQueryId, setActiveQueryId] = useState<Hex | undefined>(undefined);
  const { data: minPaymentPerAgent } = useMinPaymentPerAgent();
  // Until the user edits it, the payment defaults to 10x the per-agent minimum
  const suggestedPayment = minPaymentPerAgent != null && minPaymentPerAgent > 0n ? minPaymentPerAgent * 10n : parseEther('0.001');
  const queryPayment = queryPaymentInput ?? formatEther(suggestedPayment);
  const { keyPair, unlock } = useEncryptionKey();
  const { submitQuery, isSubmitting } = useSubmitQuery();
  const { data: activeQuery } = useQueryInfo(activeQueryId);
  const querySettled = activeQuery?.status === QueryStatus.Completed || activeQuery?.status === QueryStatus.Failed;
  const { data: activeResponses } = useQueryResponses(activeQueryId, querySettled);

  const metadata = agent?.metadata;
  const agentName = metadata?.name || (agent ? `Agent ${agent.agentId.slice(0, 10)}...` : 'Loading...');
  const agentPublicKey = metadata?.publicKey && isValidPublicKey(metadata.publicKey) ? metadata.publicKey : undefined;
  const isOwner = mounted && !!agent && !!address && agent.owner.toLowerCase() === address.toLowerCase();
  // Only link to websites with a web scheme; metadata is agent-controlled
  const website = metadata?.website && /^https?:\/\//i.test(metadata.website) ? metadata.website : undefined;
  const isActive = agent?.status === 'active';
  const connected = mounted && isConnected;

  const userStaked = position ? formatEther(position.amount) : '0';
  const userPendingRewards = position ? formatEther(position.pendingRewards) : '0';
  const userUnbonding = position ? formatEther(position.unbondingAmount) : '0';
  const userWithdrawable = position ? formatEther(position.withdrawableAmount) : '0';
  const nextUnlock = position && position.nextUnlockTime > 0n ? position.nextUnlockTime : null;

  const health = agent?.healthStatus ?? 'unknown';

  const handleConnect = () => {
    const injected = connectors.find((c) => c.id === 'injected');
    if (injected) connect({ connector: injected });
  };

  /** Sends a staking transaction and refreshes on-chain and indexed data once it is mined */
  const runStakingTx = async (send: () => Promise<Hex>, successMessage: string) => {
    if (!publicClient) return;
    setTxError(null);
    setTxPending(true);
    try {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted');
      toast.success(successMessage);
      setAmount('');
      void refetchPosition();
      void refetchAgent();
    } catch (err) {
      const message = err instanceof Error ? err.message.split('\n')[0] : 'Transaction failed';
      setTxError(message);
      toast.error(message);
    } finally {
      setTxPending(false);
    }
  };

  const handleStakeSubmit = () => {
    if (!agentId || !isAmount(amount)) return;
    // parseEther runs inside the sender so malformed amounts surface through runStakingTx's error handling
    if (stakingMode === 'stake') {
      void runStakingTx(
        () => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'stake', args: [agentId], value: parseEther(amount) }),
        'Staked successfully',
      );
    } else {
      void runStakingTx(() => {
        const value = parseEther(amount);
        const unstakeAll = !!position && value >= position.amount;
        return writeContractAsync({
          chainId: targetChain.id,
          address: CONTRACT_ADDRESSES.staking,
          abi: STAKING_ABI,
          functionName: 'unstake',
          args: [agentId, unstakeAll ? maxUint256 : value],
        });
      }, 'Unbonding started');
    }
  };

  const handleClaimRewards = () => {
    if (!agentId) return;
    void runStakingTx(
      () => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'claimRewards', args: [agentId] }),
      'Rewards claimed',
    );
  };

  const handleWithdraw = () => {
    if (!agentId) return;
    void runStakingTx(
      () => writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'withdraw', args: [agentId] }),
      'Stake withdrawn',
    );
  };

  const handleMax = () => {
    if (stakingMode === 'unstake') {
      setAmount(userStaked);
    } else {
      // Keep a small reserve in the wallet for gas
      const balance = balanceData?.value ?? 0n;
      const maxStake = balance > GAS_RESERVE ? balance - GAS_RESERVE : 0n;
      setAmount(formatEther(maxStake));
    }
  };

  const useEncryption = encryptQueryEnabled && !!agentPublicKey;

  const handleQuerySubmit = async () => {
    if (!agentId || !prompt.trim() || !isAmount(queryPayment)) return;
    try {
      const replyKeyPair = useEncryption ? (keyPair ?? (await unlock())) : undefined;
      const queryId = await submitQuery({
        agentId,
        prompt: prompt.trim(),
        payment: parseEther(queryPayment),
        ttlSeconds: QUERY_TTL_SECONDS,
        agentPublicKey: useEncryption ? agentPublicKey : undefined,
        replyKeyPair,
      });
      setActiveQueryId(queryId);
      setPrompt('');
      toast.success('Query submitted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message.split('\n')[0] : 'Query failed');
    }
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex flex-col items-center gap-3 py-16" role="status">
          <Loader2 className="size-6 animate-spin text-[#898981]" aria-hidden />
          <p className="text-sm text-[#6a6a65]">Loading agent...</p>
        </div>
      </PageLayout>
    );
  }

  if (agentError || !agent) {
    return (
      <PageLayout>
        <div className="px-5 py-16 text-center" role="alert">
          <h1 className="mb-1 text-base font-semibold text-[#191918]">Agent not found</h1>
          <p className="mx-auto mb-1 max-w-md text-sm text-[#898981]">
            This link does not point to a registered agent. Check the agent ID, or find the agent in the registry.
          </p>
          {agentError instanceof Error && <p className="mx-auto mb-5 max-w-md text-xs text-[#6a6a65]">{agentError.message}</p>}
          <Button variant="secondary" onClick={() => router.push('/agents')} className="mt-4">
            Browse agents
          </Button>
        </div>
      </PageLayout>
    );
  }

  const statusTone: StatusTone = !isActive ? 'error' : health === 'healthy' ? 'ok' : health === 'unhealthy' ? 'warn' : 'muted';
  const statusLabel = !isActive ? capitalize(agent.status) : health === 'healthy' ? 'Online' : health === 'unhealthy' ? 'Unreachable' : 'Not checked yet';
  const successRate = agent.totalQueries > 0 ? `${Number(((agent.successfulQueries / agent.totalQueries) * 100).toFixed(1))}%` : null;
  const healthCheckedAt = agent.healthCheckedAt ? Date.parse(agent.healthCheckedAt) / 1000 : null;
  const stakeDisabled = wrongNetwork || !isAmount(amount) || txPending || (stakingMode === 'stake' && !isActive);
  const queryDisabled = wrongNetwork || !prompt.trim() || !isAmount(queryPayment) || isSubmitting;
  const queryCols = 'grid-cols-[88px_minmax(0,1fr)_auto_14px] md:grid-cols-[120px_minmax(0,1fr)_100px_100px_110px_120px_20px]';

  return (
    <PageLayout>
      <div className="pb-24 pt-6 md:pt-8">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-5 lg:px-10">
          <nav aria-label="Breadcrumb" className="mb-3 min-w-0 break-words text-[13px] text-[#898981]">
            <Link href="/agents" className="text-[#6a6a65] hover:text-[#191918]">
              Agent Registry
            </Link>
            <span aria-hidden="true" className="mx-1.5">
              /
            </span>
            <span aria-current="page">{agentName}</span>
          </nav>

          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <AgentLogo name={agentName} image={metadata?.image} size="lg" />
              <div className="min-w-0">
                <h1 className="mb-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 break-words text-2xl font-bold leading-tight tracking-[-0.03em] text-[#191918]">
                  <span className="min-w-0 break-words">{agentName}</span>
                  <StatusDot
                    tone={statusTone}
                    className="gap-1.5 font-normal tracking-normal"
                  >
                    <span title={healthCheckedAt ? `Last health check ${formatDateTime(healthCheckedAt)}` : undefined}>{statusLabel}</span>
                  </StatusDot>
                </h1>
                {metadata?.description && <p className="max-w-xl text-sm leading-5 text-[#898981]">{metadata.description}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setActiveTab('stake')}>
                Stake
              </Button>
              <Button onClick={() => setActiveTab('query')}>
                Send query
              </Button>
            </div>
          </div>

          <section aria-labelledby="overview-heading" className="mb-10">
            <SectionLabel id="overview-heading">Overview</SectionLabel>
            <KeyValueList columns={2}>
              <KeyValueRow label="Success rate">
                {successRate ? (
                  <>
                    <span className={monoNumber}>{successRate}</span>
                    <Muted>
                      {agent.successfulQueries.toLocaleString()} of {agent.totalQueries.toLocaleString()} answered
                    </Muted>
                  </>
                ) : (
                  <span className="text-[#898981]">No queries yet</span>
                )}
              </KeyValueRow>
              <KeyValueRow label="Agent ID">
                <HashLink value={agent.agentId} href={`/agents/${agent.agentId}`} />
              </KeyValueRow>
              <KeyValueRow label="Staked">
                <span className={monoNumber}>{formatEthAmount(agent.totalStake)} ETH</span>
                <Muted>
                  {agent.stakerCount.toLocaleString()} {agent.stakerCount === 1 ? 'staker' : 'stakers'}
                </Muted>
              </KeyValueRow>
              <KeyValueRow label="Owner">
                <HashLink value={agent.owner} explorer="address" />
                {isOwner && <Muted>You</Muted>}
              </KeyValueRow>
              <KeyValueRow label="Reputation">
                <span className={monoNumber}>{Number(agent.reputationScore).toLocaleString()}</span>
                <Muted>of {MAX_BPS.toLocaleString()}</Muted>
              </KeyValueRow>
              <KeyValueRow label="Endpoint">
                <span className="break-all font-mono text-[13px]">{agent.endpoint}</span>
              </KeyValueRow>
              <KeyValueRow label="Failed">
                <span className={monoNumber}>{agent.failedQueries.toLocaleString()}</span>
                <Muted>missed queries</Muted>
              </KeyValueRow>
              <KeyValueRow label="Registered">{formatDateTime(agent.registeredAt)}</KeyValueRow>
              {agent.capabilities.length > 0 && (
                <KeyValueRow label="Capabilities">
                  <span className="font-mono text-[13px]">{agent.capabilities.join(', ')}</span>
                </KeyValueRow>
              )}
              {healthCheckedAt && (
                <KeyValueRow label="Health check">
                  {health === 'healthy' ? 'Healthy' : health === 'unhealthy' ? 'Unreachable' : 'Not checked yet'}
                  <Muted>
                    <span title={formatDateTime(healthCheckedAt)}>{formatRelativeTime(healthCheckedAt)}</span>
                  </Muted>
                </KeyValueRow>
              )}
              {website && (
                <KeyValueRow label="Website">
                  <a href={website} target="_blank" rel="noopener noreferrer nofollow" className={cn(textLink, 'break-all')}>
                    {website.replace(/^https?:\/\//i, '')}
                  </a>
                </KeyValueRow>
              )}
            </KeyValueList>
          </section>

          <UnderlineTabs<AgentTab>
            label="Agent sections"
            tabs={[
              { value: 'queries', label: 'Queries' },
              { value: 'query', label: 'Send query' },
              { value: 'stake', label: 'Stake' },
            ]}
            active={activeTab}
            onChange={setActiveTab}
          />

          {activeTab === 'queries' && (
            <div>
              <div role="table" aria-label="Queries assigned to this agent" className="text-sm">
                <div role="row" className={cn(tableHeadRow, queryCols)}>
                  <span role="columnheader">Query</span>
                  <span role="columnheader">Prompt</span>
                  <span role="columnheader" className="hidden md:block">Type</span>
                  <span role="columnheader">Status</span>
                  <span role="columnheader" className="hidden text-right md:block">Payment</span>
                  <span role="columnheader" className="hidden text-right md:block">Created</span>
                  <span aria-hidden="true" />
                </div>
                {(agentQueries?.data ?? []).map((query) => {
                  const preview = promptPreview(query);
                  const status = query.cancelled ? { tone: 'muted' as const, label: 'Cancelled' } : QUERY_STATUS[query.status];
                  return (
                    <Link key={query.id} href={`/queries/${query.id}`} role="row" className={cn(tableBodyRow, queryCols)}>
                      <span role="cell" title={query.id} className="font-mono text-[13px] underline decoration-[#c8c8c0] underline-offset-[3px]">
                        {query.id.slice(0, 10)}
                      </span>
                      <span role="cell" className={cn('min-w-0 truncate', !preview && 'text-[#898981]')}>
                        {preview ?? (query.queryType === 'encrypted' ? 'Encrypted prompt' : 'No readable prompt')}
                      </span>
                      <span role="cell" className="hidden text-[13px] text-[#6a6a65] md:block">
                        {capitalize(query.queryType)}
                      </span>
                      <span role="cell">
                        <StatusDot tone={status.tone}>{status.label}</StatusDot>
                      </span>
                      <span role="cell" className={cn(monoNumber, 'hidden text-right md:block')}>
                        {formatEthAmount(BigInt(query.payment))} ETH
                      </span>
                      <span role="cell" title={formatDateTime(Date.parse(query.createdAt) / 1000)} className="hidden text-right text-[13px] text-[#6a6a65] md:block">
                        {formatShortDateTime(query.createdAt)}
                      </span>
                      <ChevronRight className="size-3.5 text-[#a0a098]" strokeWidth={2} aria-hidden />
                    </Link>
                  );
                })}
              </div>
              {queriesLoading ? (
                <p role="status" className="mt-4 text-[13px] text-[#898981]">
                  Loading queries...
                </p>
              ) : queriesError ? (
                <p role="alert" className="mt-4 text-[13px] text-[#9a2f1a]">
                  Could not load queries{queriesError instanceof Error ? `: ${queriesError.message}` : ''}
                </p>
              ) : !agentQueries || agentQueries.data.length === 0 ? (
                <p className="mt-4 text-[13px] text-[#898981]">No queries have been assigned to this agent yet.</p>
              ) : (
                <p className="mt-4 text-[13px] text-[#898981]">
                  Showing {agentQueries.data.length.toLocaleString()} of {agentQueries.total.toLocaleString()}{' '}
                  {agentQueries.total === 1 ? 'query' : 'queries'}
                </p>
              )}
            </div>
          )}

          {activeTab === 'query' && (
            <>
              {!isActive ? (
                <p className="pt-6 text-sm text-[#898981]">This agent is {agent.status} and can&apos;t accept queries.</p>
              ) : (
                <form
                  className={formGrid}
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleQuerySubmit();
                  }}
                >
                  <label htmlFor="query-prompt" className={inputLabel}>
                    Prompt
                  </label>
                  <span className="flex flex-col gap-1.5">
                    <textarea
                      id="query-prompt"
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      maxLength={4000}
                      rows={4}
                      placeholder="ETH price and 24h change"
                      aria-describedby="query-prompt-count"
                      className="resize-y rounded-xl border border-[#e5e4db] bg-white px-3 py-[10px] text-sm leading-normal text-[#191918] outline-none focus:border-[#898981]"
                    />
                    <span id="query-prompt-count" className={cn(hintText, 'self-end')}>
                      {prompt.length}/4000
                    </span>
                  </span>

                  <label htmlFor="query-payment" className={inputLabel}>
                    Payment
                  </label>
                  <span className="flex flex-col gap-1.5">
                    <EthInput
                      id="query-payment"
                      value={queryPayment}
                      onChange={setQueryPayment}
                      describedBy={minPaymentPerAgent != null ? 'query-payment-hint' : undefined}
                    />
                    {minPaymentPerAgent != null && (
                      <span id="query-payment-hint" className={hintText}>
                        Minimum {formatEther(minPaymentPerAgent)} ETH per agent
                      </span>
                    )}
                  </span>

                  <span className={fieldLabel}>Encryption</span>
                  <span className="flex flex-col gap-1.5">
                    <label className={cn('flex items-center gap-2 pt-0.5', !agentPublicKey && 'text-[#898981]')}>
                      <input
                        type="checkbox"
                        checked={useEncryption}
                        disabled={!agentPublicKey}
                        onChange={(e) => setEncryptQueryEnabled(e.target.checked)}
                        className="m-0 size-4 accent-[#191918]"
                      />
                      Seal the prompt to this agent&apos;s key
                    </label>
                    {!agentPublicKey && (
                      <span className={hintText}>
                        This agent has not published an encryption key, so the prompt is stored on-chain in plaintext and readable by anyone.
                      </span>
                    )}
                  </span>

                  <span className={fieldLabel}>Deadline</span>
                  <span className="flex flex-col gap-1.5">
                    <span>{QUERY_TTL_SECONDS / 60} minutes</span>
                    <span className={hintText}>The payment is refunded if the agent does not answer in time.</span>
                  </span>

                  <span className="hidden sm:block" />
                  {connected ? (
                    <Button type="submit" disabled={queryDisabled} isLoading={isSubmitting} className="mt-2 justify-self-start sm:mt-0">
                      {isSubmitting ? 'Submitting...' : 'Send query'}
                    </Button>
                  ) : (
                    <Button onClick={handleConnect} className="mt-2 justify-self-start sm:mt-0">
                      Connect wallet
                    </Button>
                  )}
                </form>
              )}

              {activeQueryId && (
                <section aria-labelledby="answer-heading" className="mt-10 max-w-[640px]">
                  <SectionLabel id="answer-heading">Your query</SectionLabel>
                  <KeyValueList>
                    <KeyValueRow label="Query">
                      <HashLink value={activeQueryId} href={`/queries/${activeQueryId}`} />
                    </KeyValueRow>
                    <KeyValueRow label="Answer">
                      <div aria-live="polite">
                        {!querySettled ? (
                          <span className="inline-flex items-start gap-2 text-[#898981]">
                            <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" aria-hidden />
                            <span>
                              Waiting for the agent ({activeQuery?.status === QueryStatus.InProgress ? 'answer received, settling' : 'delivering'})...
                              {activeQuery && activeQuery.deadline > 0n && (
                                <span className="block text-xs">Deadline {formatRelativeTime(activeQuery.deadline)}</span>
                              )}
                            </span>
                          </span>
                        ) : activeQuery?.status === QueryStatus.Failed ? (
                          <span className="text-[#898981]">The agent didn&apos;t answer before the deadline. Your payment was refunded.</span>
                        ) : (
                          <div className="flex flex-col items-start gap-3">
                            {activeQuery?.queryType === 'encrypted' && !keyPair && (
                              <Button size="sm" onClick={() => void unlock()}>
                                Unlock to decrypt
                              </Button>
                            )}
                            {(activeResponses ?? []).map((response) => (
                              <p key={response.agentId} className="m-0 whitespace-pre-wrap break-words text-[#191918]">
                                {readAnswer(response.responseData, activeQuery?.queryType === 'encrypted', keyPair)}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </KeyValueRow>
                  </KeyValueList>
                </section>
              )}
            </>
          )}

          {activeTab === 'stake' && (
            <>
              <form
                className={formGrid}
                onSubmit={(e) => {
                  e.preventDefault();
                  handleStakeSubmit();
                }}
              >
                {connected && (
                  <>
                    <span className={inputLabel}>Action</span>
                    <span role="group" aria-label="Staking action" className="inline-flex justify-self-start rounded-lg border border-[#e5e4db] bg-white p-0.5">
                      {(['stake', 'unstake'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          aria-pressed={stakingMode === mode}
                          onClick={() => setStakingMode(mode)}
                          className={cn(
                            'h-7 cursor-pointer rounded-md px-2.5 text-[13px] transition-colors',
                            stakingMode === mode ? 'bg-[#f0efe6] font-semibold text-[#191918]' : 'text-[#6a6a65] hover:text-[#191918]',
                          )}
                        >
                          {mode === 'stake' ? 'Stake' : 'Unstake'}
                        </button>
                      ))}
                    </span>

                    <label htmlFor="stake-amount" className={inputLabel}>
                      Amount
                    </label>
                    <span className="flex flex-col gap-1.5">
                      <EthInput
                        id="stake-amount"
                        value={amount}
                        onChange={setAmount}
                        placeholder="0.00"
                        ariaLabel={stakingMode === 'stake' ? 'Amount to stake in ETH' : 'Amount to unstake in ETH'}
                        describedBy="stake-amount-hint"
                        action={
                          <Button
                            type="button"
                            onClick={handleMax}
                            aria-label={stakingMode === 'stake' ? 'Use maximum wallet balance' : 'Use full staked balance'}
                            variant="tonal"
                            size="sm"
                          >
                            Max
                          </Button>
                        }
                      />
                      <span id="stake-amount-hint" className={hintText}>
                        {stakingMode === 'stake'
                          ? `Minimum ${minimumStake != null ? formatEther(minimumStake) : '...'} ETH`
                          : `Unstaked ETH unlocks ${unstakingPeriod != null ? formatDuration(unstakingPeriod) : '...'} after you unstake`}
                      </span>
                      <span className={hintText}>
                        Wallet {formatEth(walletBalance)} ETH, staked {formatEth(userStaked)} ETH
                      </span>
                    </span>
                  </>
                )}

                {feeSplit && (
                  <>
                    <span className={fieldLabel}>Rewards</span>
                    <span className="flex flex-col gap-1.5">
                      <span className="leading-normal">
                        {bpsToPercent(feeSplit.stakerFee)} of every query fee this agent earns is shared among its stakers.
                      </span>
                      {stakingStats && (
                        <span className={hintText}>
                          {stakingStats.apy.toFixed(2)}% APY and {formatEthAmount(BigInt(stakingStats.rewardsDistributed30d))} ETH paid out over the last 30 days
                        </span>
                      )}
                    </span>
                  </>
                )}

                {unstakingPeriod != null && (
                  <>
                    <span className={fieldLabel}>Unbonding</span>
                    <span>{formatDuration(unstakingPeriod)} after you unstake</span>
                  </>
                )}

                {connected && stakingMode === 'stake' && !isActive && (
                  <>
                    <span className="hidden sm:block" />
                    <p role="alert" className="m-0 text-[#9a2f1a]">
                      This agent is {agent.status}; new stakes are not accepted.
                    </p>
                  </>
                )}

                {txError && (
                  <>
                    <span className="hidden sm:block" />
                    <p role="alert" className="m-0 break-words text-[#9a2f1a]">
                      {txError}
                    </p>
                  </>
                )}

                <span className="hidden sm:block" />
                {connected ? (
                  <Button type="submit" disabled={stakeDisabled} isLoading={txPending} className="mt-2 justify-self-start sm:mt-0">
                    {txPending ? 'Processing...' : stakingMode === 'stake' ? 'Stake ETH' : 'Start unbonding'}
                  </Button>
                ) : (
                  <Button onClick={handleConnect} className="mt-2 justify-self-start sm:mt-0">
                    Connect wallet
                  </Button>
                )}
              </form>

              {connected && (
                <section aria-labelledby="position-heading" className="mt-10 max-w-[640px]">
                  <SectionLabel id="position-heading">Your position</SectionLabel>
                  <KeyValueList>
                    <KeyValueRow label="Staked">
                      <span className={monoNumber}>{formatEth(userStaked)} ETH</span>
                    </KeyValueRow>
                    <KeyValueRow label="Pending rewards">
                      <span className={monoNumber}>{formatEth(userPendingRewards)} ETH</span>
                      <Button
                        type="button"
                        onClick={handleClaimRewards}
                        disabled={wrongNetwork || !position || position.pendingRewards === 0n || txPending}
                        variant="secondary"
                        size="sm"
                        className="ml-3"
                      >
                        Claim
                      </Button>
                    </KeyValueRow>
                    <KeyValueRow label="Unbonding">
                      <span className={monoNumber}>{formatEth(userUnbonding)} ETH</span>
                      {nextUnlock && (
                        <Muted>
                          <span title={formatDateTime(nextUnlock)}>next unlock {formatRelativeTime(nextUnlock)}</span>
                        </Muted>
                      )}
                    </KeyValueRow>
                    <KeyValueRow label="Withdrawable">
                      <span className={monoNumber}>{formatEth(userWithdrawable)} ETH</span>
                      <Button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={wrongNetwork || !position || position.withdrawableAmount === 0n || txPending}
                        variant="secondary"
                        size="sm"
                        className="ml-3"
                      >
                        Withdraw
                      </Button>
                    </KeyValueRow>
                  </KeyValueList>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
