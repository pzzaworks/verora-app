'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { formatEther, type Hex } from 'viem';
import toast from 'react-hot-toast';
import { AlertCircle, Check, Copy, Loader2, MessageSquare } from 'lucide-react';
import { PageLayout } from '@/components/shared/page-layout';
import { AgentLogo } from '@/components/ui/agent-logo';
import { Button } from '@/components/ui/button';
import {
  HashLink,
  KeyValueList,
  KeyValueRow,
  Muted,
  SectionLabel,
  StatusDot,
  monoNumber,
  tableBodyRow,
  tableHeadRow,
  type StatusTone,
} from '@/components/ui/data-display';
import { CONTRACT_ADDRESSES, QUERY_CONSUMER_ABI } from '@/config/contracts';
import { targetChain } from '@/config/wagmi';
import { useAllAgents, type AgentMetadata } from '@/hooks/use-agents';
import { useIsClient } from '@/hooks/use-is-client';
import { useIsWrongNetwork } from '@/hooks/use-network';
import {
  QueryStatus,
  queryStatusLabel,
  useEncryptionKey,
  usePendingRefund,
  useQueryDetail,
  type QueryDetail,
  type QueryDispatchDetail,
} from '@/hooks/use-queries';
import { useFeeSplit } from '@/hooks/use-staking';
import { decodeText, readAnswer } from '@/lib/encryption';
import { cn, formatDateTime, formatRelativeTime, shortHex } from '@/lib/utils';

const QUERY_ID_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const MAX_BPS = 10_000n;

const errorText = (error: Error) => error.message.split('\n')[0];

/** ETH amount with up to six decimals, so fee splits of small payments stay exact: "0.0128" */
function formatEth(wei: bigint): string {
  if (wei === 0n) return '0';
  const value = Number(formatEther(wei));
  if (value < 0.000001) return '< 0.000001';
  return value.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

/** Short local timestamp with seconds: "Oct 13, 11:20:15" */
function formatStamp(unixSeconds: bigint): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
}

/** Seconds between two unix timestamps as "65 s", "3m 12s" or "1h 5m" */
function formatElapsed(seconds: bigint): string {
  const total = Number(seconds < 0n ? 0n : seconds);
  if (total < 120) return `${total} s`;
  const minutes = Math.floor(total / 60);
  if (minutes < 60) return `${minutes}m ${total % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

/** ISO timestamp for a <time> element from unix seconds */
const isoTime = (unixSeconds: bigint) => new Date(Number(unixSeconds) * 1000).toISOString();

/** Basis points as a percentage label: 8000 -> "80", 3333 -> "33.33" */
const bpsLabel = (bps: bigint) => (Number(bps) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });

/** "A", "A and B", "A, B and C" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * What each responder was paid, following QueryConsumer settlement: the payment is split equally
 * between responders in submission order and the last one also receives the rounding remainder.
 */
function responderPayouts(query: QueryDetail): Map<string, bigint> {
  const payouts = new Map<string, bigint>();
  const count = BigInt(query.responses.length);
  if (query.status !== QueryStatus.Completed || count === 0n) return payouts;
  const share = query.payment / count;
  const remainder = query.payment - share * count;
  query.responses.forEach((response, i) => {
    payouts.set(response.agentId.toLowerCase(), i === query.responses.length - 1 ? share + remainder : share);
  });
  return payouts;
}

function deliveryText(dispatch: QueryDispatchDetail): string {
  if (dispatch.status === 'relayed') return 'Relayed by oracle';
  if (dispatch.status === 'failed') return dispatch.lastError ?? `Failed after ${dispatch.attempts} attempt${dispatch.attempts === 1 ? '' : 's'}`;
  return dispatch.attempts > 0 ? `Retrying, ${dispatch.attempts} attempt${dispatch.attempts === 1 ? '' : 's'}` : 'Queued';
}

function statusTone(status: QueryStatus): StatusTone {
  if (status === QueryStatus.Completed) return 'ok';
  if (status === QueryStatus.Failed) return 'error';
  return 'warn';
}

/** Placeholder dash for empty table cells */
const Dash = () => <span className="text-[13px] text-[#a0a098]">-</span>;

// Column layouts for the agents table: Agent, Status, Answer on phones; Paid joins at md; all six at lg
const AGENT_COLS = 'grid-cols-[minmax(0,1fr)_96px_132px] md:grid-cols-[minmax(0,1fr)_130px_120px_180px] lg:grid-cols-[minmax(0,1fr)_130px_180px_160px_120px_180px]';
const PAYOUT_COLS = 'grid-cols-[minmax(0,1fr)_72px_112px] sm:grid-cols-[minmax(0,1fr)_120px_140px]';

export default function QueryDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const rawId = typeof params.id === 'string' ? params.id : '';
  const validId = QUERY_ID_PATTERN.test(rawId);
  const queryId = validId ? (rawId.toLowerCase() as Hex) : undefined;

  const mounted = useIsClient();
  const { address } = useAccount();
  const { data: query, isLoading, notFound, error } = useQueryDetail(queryId);
  const { data: allAgents } = useAllAgents();
  const { data: feeSplit, isError: feeSplitError } = useFeeSplit();
  const { keyPair, unlock } = useEncryptionKey();

  const isRequester = mounted && !!query && !!address && query.requester.toLowerCase() === address.toLowerCase();
  const { data: pendingRefund, refetch: refetchRefund } = usePendingRefund(isRequester ? address : undefined);
  const { writeContractAsync } = useWriteContract();
  const wrongNetwork = useIsWrongNetwork();
  const publicClient = usePublicClient();
  const [withdrawing, setWithdrawing] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // Clock for deadline checks, ticking so an open query notices its deadline passing
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  // Reset the "copied" check mark shortly after a copy
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const agentMetadataMap = useMemo(() => {
    const map = new Map<string, AgentMetadata>();
    for (const agent of allAgents) {
      if (agent.metadata) map.set(agent.agentId.toLowerCase(), agent.metadata);
    }
    return map;
  }, [allAgents]);
  const agentName = (id: string) => agentMetadataMap.get(id.toLowerCase())?.name || `Agent ${shortHex(id, 8, 4)}`;
  const agentImage = (id: string) => agentMetadataMap.get(id.toLowerCase())?.image;

  const copyQueryId = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Query ID copied');
    } catch {
      toast.error('Could not copy to the clipboard');
    }
  };

  const toggleAnswer = (agentKey: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(agentKey)) next.delete(agentKey);
      else next.add(agentKey);
      return next;
    });

  const handleUnlock = async (agentKey: string) => {
    setUnlocking(true);
    try {
      await unlock();
      setExpanded((current) => new Set(current).add(agentKey));
    } catch (e) {
      toast.error(e instanceof Error ? errorText(e) : 'Could not unlock');
    } finally {
      setUnlocking(false);
    }
  };

  const handleWithdrawRefund = async () => {
    setWithdrawing(true);
    try {
      const hash = await writeContractAsync({ chainId: targetChain.id, address: CONTRACT_ADDRESSES.queryConsumer, abi: QUERY_CONSUMER_ABI, functionName: 'withdrawRefund' });
      const receipt = publicClient ? await publicClient.waitForTransactionReceipt({ hash }) : null;
      if (receipt && receipt.status !== 'success') throw new Error('Transaction reverted');
      toast.success('Refund withdrawn');
      void refetchRefund();
    } catch (e) {
      toast.error(e instanceof Error ? errorText(e) : 'Transaction failed');
    } finally {
      setWithdrawing(false);
    }
  };

  if (validId && isLoading) {
    return (
      <PageLayout>
        <div className="py-16 flex flex-col items-center gap-3" role="status">
          <Loader2 className="w-6 h-6 animate-spin text-[#898981]" aria-hidden />
          <p className="text-sm text-[#6a6a65]">Loading query...</p>
        </div>
      </PageLayout>
    );
  }

  if (!validId || notFound || error || !query) {
    const failed = validId && !notFound && !!error;
    return (
      <PageLayout>
        <div className="py-16 px-5 text-center" role="alert">
          {failed ? (
            <AlertCircle className="w-7 h-7 text-red-500 mx-auto mb-4" strokeWidth={1.5} aria-hidden />
          ) : (
            <MessageSquare className="w-7 h-7 text-[#898981] mx-auto mb-4" strokeWidth={1.5} aria-hidden />
          )}
          <h1 className="text-base font-semibold text-[#191918] mb-1">{failed ? 'Could not load this query' : 'Query not found'}</h1>
          <p className="text-sm text-[#898981] max-w-md mx-auto mb-1">
            {failed
              ? 'The query could not be read from the API or the chain. Try again in a moment.'
              : 'This link does not point to a query on this network. Check the query ID, or find your queries on the dashboard.'}
          </p>
          {failed && error instanceof Error && <p className="text-xs text-[#6a6a65] max-w-md mx-auto mb-5">{errorText(error)}</p>}
          <Button variant="tonal" onClick={() => router.push('/dashboard')} className="mt-4">
            Go to dashboard
          </Button>
        </div>
      </PageLayout>
    );
  }

  const encrypted = query.queryType === 'encrypted';
  const open = query.status === QueryStatus.Pending || query.status === QueryStatus.InProgress;
  const settled = !open;
  const completed = query.status === QueryStatus.Completed;
  const cancelled = query.status === QueryStatus.Failed && query.cancelled === true;
  const agentCount = query.assignedAgents.length;
  const responseCount = query.responses.length;
  const deadlinePassed = mounted && Number(query.deadline) * 1000 < now;
  const payouts = responderPayouts(query);
  const responseByAgent = new Map(query.responses.map((response) => [response.agentId.toLowerCase(), response]));
  const dispatchByAgent = new Map((query.dispatches ?? []).map((dispatch) => [dispatch.agentId.toLowerCase(), dispatch]));
  const canDecrypt = encrypted && isRequester;
  const paidOut = [...payouts.values()].reduce((sum, amount) => sum + amount, 0n);
  const shortId = shortHex(query.queryId);

  const aggregatedText =
    completed && !encrypted && query.aggregatedResult && query.aggregatedResult !== '0x'
      ? decodeText(query.aggregatedResult)
      : null;

  // Reputation effect of this query per agent, mirroring QueryConsumer: responders get a success on
  // settlement, non-responders a failure, and a cancelled query records nothing
  const reputationText = (answered: boolean): string | null => {
    if (open) return 'Pending';
    if (cancelled) return 'Not recorded';
    if (query.status === QueryStatus.Failed && query.cancelled === null) return null;
    return answered ? 'Success recorded' : 'Failure recorded';
  };

  // Payout rows, using the PaymentRouter fee split on each responder's payment
  const payoutRows = feeSplit && paidOut > 0n
    ? (() => {
        // `agent` is set on rows paid to an agent's owner or stakers, so the row can show its logo
        const rows: Array<{ key: string; recipient: string; amount: bigint; agent?: { name: string; image?: string } }> = [];
        let protocol = 0n;
        for (const response of query.responses) {
          const amount = payouts.get(response.agentId.toLowerCase()) ?? 0n;
          const platform = (amount * feeSplit.platformFee) / MAX_BPS;
          const stakers = (amount * feeSplit.stakerFee) / MAX_BPS;
          protocol += platform;
          const name = agentName(response.agentId);
          const agent = { name, image: agentImage(response.agentId) };
          rows.push({ key: `${response.agentId}-owner`, recipient: `${name} owner`, amount: amount - platform - stakers, agent });
          rows.push({ key: `${response.agentId}-stakers`, recipient: `${name} stakers`, amount: stakers, agent });
        }
        rows.push({ key: 'protocol', recipient: 'Protocol treasury', amount: protocol });
        return rows;
      })()
    : null;

  const nonResponders = query.assignedAgents.filter((id) => !responseByAgent.has(id.toLowerCase())).map(agentName);
  const responders = query.responses.map((response) => agentName(response.agentId));
  const redistributionNote =
    completed && nonResponders.length > 0 && responders.length > 0
      ? `The whole payment goes to the agents that answered, so ${
          nonResponders.length === 1 ? `${nonResponders[0]}'s share` : `the shares of ${joinNames(nonResponders)}`
        } ${responders.length === 1 ? `went to ${responders[0]}` : `was split between ${joinNames(responders)}`}.`
      : null;

  const agentsNote = encrypted && responseCount > 0
    ? isRequester
      ? keyPair
        ? null
        : 'Answers are encrypted for your wallet. Unlocking asks for a signature that derives your decryption key, nothing is sent on-chain.'
      : 'Answers are encrypted for the requester. Connect the requesting wallet to read them.'
    : null;

  return (
    <PageLayout>
      <div className="pt-8 pb-24">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-5 lg:px-10">

          <nav aria-label="Breadcrumb" className="mb-3 text-[13px] text-[#898981]">
            <Link href="/dashboard" className="text-[#6a6a65] hover:text-[#191918]">Dashboard</Link>
            <span aria-hidden="true" className="mx-1.5">/</span>
            <span aria-current="page">Query {shortId}</span>
          </nav>

          <div className="mb-8">
            <h1 className="mb-1 flex flex-wrap items-center gap-3 text-2xl font-bold leading-[1.25] tracking-[-0.03em] text-[#191918]">
              Query
              <span className="font-mono text-xl font-medium tracking-normal" title={query.queryId}>{shortId}</span>
              <Button
                variant="secondary"
                size="sm"
                icon
                onClick={() => void copyQueryId(query.queryId)}
                aria-label="Copy query ID"
                title="Copy full ID"
              >
                {copied ? (
                  <Check className="size-3.5 text-[#3d8b3e]" strokeWidth={2} aria-hidden />
                ) : (
                  <Copy className="size-3.5 text-[#6a6a65]" strokeWidth={2} aria-hidden />
                )}
              </Button>
            </h1>
            <p className="m-0 flex flex-wrap items-center gap-2 text-sm leading-5 text-[#6a6a65]">
              <StatusDot tone={statusTone(query.status)} className="text-sm text-[#6a6a65]">{queryStatusLabel(query.status)}</StatusDot>
              <span aria-hidden="true">·</span>
              {encrypted ? 'Encrypted' : 'Plaintext'}
              <span aria-hidden="true">·</span>
              {responseCount} of {agentCount} agent{agentCount === 1 ? '' : 's'} answered
            </p>
            {query.source === 'chain' && (
              <p className="mt-2 text-[13px] text-[#898981]">Read directly from the chain while the indexer catches up. Delivery details appear once it is indexed.</p>
            )}
            {isRequester && !!pendingRefund && pendingRefund > 0n && (
              <div role="status" className="mt-4 flex flex-col gap-3 border-y border-[#e5e4db] py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[#191918]">
                  You have <span className={cn(monoNumber, 'font-semibold')}>{formatEth(pendingRefund)} ETH</span> in query refunds that could not be sent to your wallet automatically.
                </p>
                <Button
                  type="button"
                  onClick={() => void handleWithdrawRefund()}
                  disabled={withdrawing || wrongNetwork}
                  size="sm"
                >
                  {withdrawing ? 'Withdrawing...' : 'Withdraw refund'}
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-y-10 md:grid-cols-2 md:gap-x-12">

            <section aria-labelledby="overview-heading" className="min-w-0">
              <SectionLabel id="overview-heading">Overview</SectionLabel>
              <KeyValueList>
                <KeyValueRow label="Payment">
                  <span className={monoNumber}>
                    {formatEth(query.payment)} ETH
                    {agentCount > 1 && <Muted>{formatEth(query.payment / BigInt(agentCount))} per agent</Muted>}
                  </span>
                </KeyValueRow>
                <KeyValueRow label="Answers">
                  <span className={monoNumber}>{responseCount} / {agentCount}</span>
                </KeyValueRow>
                <KeyValueRow label="Prompt">
                  {encrypted ? (
                    <span className="text-[#6a6a65]">Sealed to each agent&apos;s key, not readable here</span>
                  ) : (
                    <span className="whitespace-pre-wrap">{decodeText(query.queryData)}</span>
                  )}
                </KeyValueRow>
                {aggregatedText !== null && (
                  <KeyValueRow label="Result">
                    <span className="whitespace-pre-wrap">{aggregatedText}</span>
                  </KeyValueRow>
                )}
                <KeyValueRow label="Created">
                  <time dateTime={isoTime(query.createdAt)} title={formatDateTime(query.createdAt)}>{formatStamp(query.createdAt)}</time>
                </KeyValueRow>
                <KeyValueRow label="Settled">
                  {query.finalizedAt ? (
                    <>
                      <time dateTime={isoTime(query.finalizedAt)} title={formatDateTime(query.finalizedAt)}>{formatStamp(query.finalizedAt)}</time>
                      <Muted>
                        {cancelled ? 'cancelled ' : query.status === QueryStatus.Failed ? 'refunded ' : ''}
                        after {formatElapsed(query.finalizedAt - query.createdAt)}
                      </Muted>
                    </>
                  ) : settled ? (
                    <span className="text-[#6a6a65]">{cancelled ? 'Cancelled, payment refunded' : query.status === QueryStatus.Failed ? 'Refunded' : 'Settled'}</span>
                  ) : (
                    <span className="text-[#6a6a65]">{deadlinePassed ? 'Deadline passed, waiting for settlement' : 'Not yet'}</span>
                  )}
                </KeyValueRow>
                <KeyValueRow label="Deadline">
                  <time dateTime={isoTime(query.deadline)} title={formatDateTime(query.deadline)} className="text-[#6a6a65]">{formatStamp(query.deadline)}</time>
                  {open && mounted && <Muted>{formatRelativeTime(query.deadline)}</Muted>}
                </KeyValueRow>
              </KeyValueList>
            </section>

            <section aria-labelledby="onchain-heading" className="min-w-0">
              <SectionLabel id="onchain-heading">On-chain</SectionLabel>
              <KeyValueList>
                <KeyValueRow label="Query ID">
                  <HashLink value={query.queryId} href={`/queries/${query.queryId}`} />
                </KeyValueRow>
                <KeyValueRow label="Requester">
                  <HashLink value={query.requester} explorer="address" />
                  {isRequester && <Muted>you</Muted>}
                </KeyValueRow>
                {query.txHash && (
                  <KeyValueRow label="Creation tx">
                    <HashLink value={query.txHash} explorer="tx" />
                  </KeyValueRow>
                )}
                <KeyValueRow label="Fee split">
                  {feeSplit ? (
                    <span className={monoNumber}>
                      {bpsLabel(feeSplit.agentFee)} / {bpsLabel(feeSplit.stakerFee)} / {bpsLabel(feeSplit.platformFee)}
                      <Muted>agent / stakers / protocol</Muted>
                    </span>
                  ) : (
                    <span className="text-[#898981]">{feeSplitError ? 'Could not read the fee split' : 'Loading...'}</span>
                  )}
                </KeyValueRow>
              </KeyValueList>
            </section>

            <section aria-labelledby="agents-heading" className="min-w-0 md:col-span-2">
              <SectionLabel id="agents-heading">Assigned agents</SectionLabel>
              {agentCount === 0 ? (
                <p className="border-t border-[#e5e4db] py-3 text-sm text-[#898981]">No agents were assigned to this query.</p>
              ) : (
                <div role="table" aria-label="Assigned agents">
                  <div role="row" className={cn(tableHeadRow, AGENT_COLS)}>
                    <span role="columnheader">Agent</span>
                    <span role="columnheader">Status</span>
                    <span role="columnheader" className="hidden lg:block">Delivery</span>
                    <span role="columnheader" className="hidden lg:block">Reputation</span>
                    <span role="columnheader" className="hidden text-right md:block">Paid</span>
                    <span role="columnheader" className="text-right">Answer</span>
                  </div>
                  {query.assignedAgents.map((agentId) => {
                    const key = agentId.toLowerCase();
                    const response = responseByAgent.get(key);
                    const dispatch = dispatchByAgent.get(key);
                    const payout = payouts.get(key);
                    const reputation = reputationText(!!response);
                    const isExpanded = expanded.has(key);
                    const readable = !!response && (!encrypted || (canDecrypt && !!keyPair));
                    const answerId = `answer-${key}`;
                    return (
                      <Fragment key={agentId}>
                        <div role="row" className={cn(tableBodyRow, AGENT_COLS, isExpanded && readable && 'border-b-0')}>
                          <span role="cell" className="flex min-w-0 items-center gap-2.5">
                            <AgentLogo name={agentName(agentId)} image={agentImage(agentId)} size="sm" />
                            <Link href={`/agents/${agentId}`} className="min-w-0 truncate font-semibold text-[#191918] hover:underline" title={agentId}>
                              {agentName(agentId)}
                            </Link>
                          </span>
                          <span role="cell">
                            {response ? (
                              <StatusDot tone="ok">Answered</StatusDot>
                            ) : cancelled ? (
                              <StatusDot tone="muted">Cancelled</StatusDot>
                            ) : settled ? (
                              <StatusDot tone="error">No answer</StatusDot>
                            ) : (
                              <StatusDot tone="warn">Waiting</StatusDot>
                            )}
                          </span>
                          <span role="cell" className="hidden min-w-0 truncate text-[13px] text-[#6a6a65] lg:block" title={dispatch?.lastError ?? undefined}>
                            {dispatch ? deliveryText(dispatch) : <Dash />}
                          </span>
                          <span role="cell" className="hidden text-[13px] text-[#6a6a65] lg:block">
                            {reputation ?? <Dash />}
                          </span>
                          <span role="cell" className={cn(monoNumber, 'hidden text-right md:block')}>
                            {open ? <Dash /> : `${formatEth(payout ?? 0n)} ETH`}
                          </span>
                          <span role="cell" className="text-right">
                            {!response ? (
                              <Dash />
                            ) : readable ? (
                              <Button
                                type="button"
                                onClick={() => toggleAnswer(key)}
                                aria-expanded={isExpanded}
                                aria-controls={answerId}
                                variant="link"
                              >
                                {isExpanded ? 'Hide answer' : 'Show answer'}
                              </Button>
                            ) : canDecrypt ? (
                              <Button
                                type="button"
                                onClick={() => void handleUnlock(key)}
                                disabled={unlocking}
                                size="sm"
                              >
                                {unlocking ? 'Unlocking...' : 'Unlock to decrypt'}
                              </Button>
                            ) : (
                              <span className="text-[13px] text-[#898981]">Encrypted</span>
                            )}
                          </span>
                        </div>
                        {readable && isExpanded && (
                          <div role="row" id={answerId} className="border-b border-[#efeee5] px-3 pb-4">
                            <div role="cell" className="whitespace-pre-wrap break-words border-l-2 border-[#e5e4db] pl-3 text-sm text-[#191918]">
                              {readAnswer(response.responseData, encrypted, keyPair)}
                            </div>
                          </div>
                        )}
                      </Fragment>
                    );
                  })}
                </div>
              )}
              {agentsNote && <p className="mt-3 text-[13px] text-[#898981]">{agentsNote}</p>}
            </section>

            <section aria-labelledby="payout-heading" className="min-w-0 md:col-span-2">
              <SectionLabel id="payout-heading">Payout</SectionLabel>
              {open ? (
                <p className="border-t border-[#e5e4db] py-3 text-sm text-[#6a6a65]">
                  <span className={monoNumber}>{formatEth(query.payment)} ETH</span> is held in escrow until the query settles. It is split between the agents that answer before the deadline, and refunded in full if none do.
                </p>
              ) : query.status === QueryStatus.Failed ? (
                <p className="border-t border-[#e5e4db] py-3 text-sm text-[#6a6a65]">
                  {cancelled
                    ? 'The requester cancelled the query before any agent answered.'
                    : query.cancelled === false
                      ? 'No agent answered before the deadline.'
                      : 'The query ended without an answer.'}
                  {' '}No agent was paid, the full <span className={monoNumber}>{formatEth(query.payment)} ETH</span> was refunded to the requester.
                </p>
              ) : payoutRows && feeSplit ? (
                <>
                  <div role="table" aria-label="Payout">
                    <div role="row" className={cn(tableHeadRow, PAYOUT_COLS)}>
                      <span role="columnheader">Recipient</span>
                      <span role="columnheader" className="text-right">Share</span>
                      <span role="columnheader" className="text-right">Amount</span>
                    </div>
                    {payoutRows.map((row) => (
                      <div role="row" key={row.key} className={cn(tableBodyRow, PAYOUT_COLS)}>
                        <span role="cell" className="flex min-w-0 items-center gap-2.5">
                          {row.agent && <AgentLogo name={row.agent.name} image={row.agent.image} size="sm" />}
                          <span className="min-w-0 truncate">{row.recipient}</span>
                        </span>
                        <span role="cell" className={cn(monoNumber, 'text-right')}>{bpsLabel((row.amount * MAX_BPS) / query.payment)}%</span>
                        <span role="cell" className={cn(monoNumber, 'text-right')}>{formatEth(row.amount)} ETH</span>
                      </div>
                    ))}
                    <div role="row" className={cn(tableBodyRow, PAYOUT_COLS, 'border-b-0 font-semibold')}>
                      <span role="cell">Total</span>
                      <span role="cell" />
                      <span role="cell" className={cn(monoNumber, 'text-right')}>{formatEth(paidOut)} ETH</span>
                    </div>
                  </div>
                  {redistributionNote && <p className="mt-3 text-[13px] text-[#898981]">{redistributionNote}</p>}
                </>
              ) : (
                <p className="border-t border-[#e5e4db] py-3 text-sm text-[#898981]">
                  {feeSplitError ? 'Could not read the fee split to break down the payout.' : 'Loading payout...'}
                </p>
              )}
            </section>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
