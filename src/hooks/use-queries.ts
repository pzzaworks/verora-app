'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAccount, usePublicClient, useReadContract, useReadContracts, useSignMessage, useWriteContract } from 'wagmi';
import { BaseError, ContractFunctionRevertedError, parseEventLogs, type Address, type Hex } from 'viem';
import { api, ApiRequestError, type ApiQuery, type ApiQueryDetail } from '@/lib/api';
import { CONTRACT_ADDRESSES, QUERY_CONSUMER_ABI } from '@/config/contracts';
import { targetChain } from '@/config/wagmi';
import { ENCRYPTION_KEY_MESSAGE, encodeText, encryptQuery, keyPairFromSignature, type EncryptionKeyPair } from '@/lib/encryption';

export const QueryStatus = { Pending: 0, InProgress: 1, Completed: 2, Failed: 3 } as const;
export type QueryStatus = (typeof QueryStatus)[keyof typeof QueryStatus];

/** Status labels shared by every place that lists or shows a query */
export const queryStatusLabel = (status: QueryStatus): string => {
  switch (status) {
    case QueryStatus.Pending: return 'Waiting for agent';
    case QueryStatus.InProgress: return 'Settling';
    case QueryStatus.Completed: return 'Completed';
    case QueryStatus.Failed: return 'Failed';
    default: return 'Unknown';
  }
};

export const queryStatusBadge = (status: QueryStatus): 'success' | 'error' | 'warning' | 'default' => {
  switch (status) {
    case QueryStatus.Completed: return 'success';
    case QueryStatus.Failed: return 'error';
    case QueryStatus.Pending:
    case QueryStatus.InProgress: return 'warning';
    default: return 'default';
  }
};

export interface QueryInfo {
  queryId: Hex;
  requester: Address;
  queryType: string;
  queryData: Hex;
  status: QueryStatus;
  createdAt: bigint;
  deadline: bigint;
  payment: bigint;
  assignedAgents: readonly Hex[];
}

/** True when a contract read reverted because the query does not exist on-chain */
function isQueryNotFoundRevert(error: unknown): boolean {
  if (!(error instanceof BaseError)) return false;
  const revert = error.walk((cause) => cause instanceof ContractFunctionRevertedError);
  return revert instanceof ContractFunctionRevertedError && revert.data?.errorName === 'QueryNotFound';
}

export function useQueryInfo(queryId: Hex | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.queryConsumer,
    abi: QUERY_CONSUMER_ABI,
    functionName: 'getQuery',
    args: queryId ? [queryId] : undefined,
    query: {
      enabled: !!queryId,
      // A missing query will not appear by retrying; other failures (RPC hiccups) are retried
      retry: (failureCount, error) => !isQueryNotFoundRevert(error) && failureCount < 3,
      // Poll until the oracle settles the query
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === QueryStatus.Completed || status === QueryStatus.Failed ? false : 3000;
      },
    },
  });
}

export function useQueryResponses(queryId: Hex | undefined, enabled = true) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.queryConsumer,
    abi: QUERY_CONSUMER_ABI,
    functionName: 'getResponses',
    args: queryId ? [queryId] : undefined,
    query: { enabled: !!queryId && enabled },
  });
}

export function useMinPaymentPerAgent() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.queryConsumer,
    abi: QUERY_CONSUMER_ABI,
    functionName: 'minPaymentPerAgent',
  });
}

export function useUserQueries(address: Address | undefined) {
  const { data: queryIds, isLoading: isLoadingIds, error: idsError } = useReadContract({
    address: CONTRACT_ADDRESSES.queryConsumer,
    abi: QUERY_CONSUMER_ABI,
    functionName: 'getQueriesByRequester',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const contracts = useMemo(
    () =>
      (queryIds ?? []).map((id) => ({
        address: CONTRACT_ADDRESSES.queryConsumer,
        abi: QUERY_CONSUMER_ABI,
        functionName: 'getQuery' as const,
        args: [id] as const,
      })),
    [queryIds],
  );

  const { data: results, isLoading: isLoadingQueries, error: queriesError } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  });

  const queries = useMemo<QueryInfo[]>(
    () =>
      (results ?? [])
        .flatMap((result) => (result.status === 'success' ? [result.result as QueryInfo] : []))
        .sort((a, b) => Number(b.createdAt - a.createdAt)),
    [results],
  );

  return { data: queries, isLoading: isLoadingIds || isLoadingQueries, error: idsError ?? queriesError };
}

/** Per-session cache of derived keys, so the wallet is asked to sign once per page load */
const keyCache = new Map<string, EncryptionKeyPair>();

/**
 * The wallet's encryption key, derived from a signature of a fixed message. Deterministic per wallet,
 * so answers to earlier queries stay decryptable after a reload without storing any secret.
 */
export function useEncryptionKey() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [keyPair, setKeyPair] = useState<EncryptionKeyPair | null>(() => (address ? keyCache.get(address) ?? null : null));

  const unlock = useCallback(async () => {
    if (!address) throw new Error('Connect a wallet first');
    const cached = keyCache.get(address);
    if (cached) {
      setKeyPair(cached);
      return cached;
    }
    const signature = await signMessageAsync({ message: ENCRYPTION_KEY_MESSAGE });
    const derived = keyPairFromSignature(signature);
    keyCache.set(address, derived);
    setKeyPair(derived);
    return derived;
  }, [address, signMessageAsync]);

  const current = address ? (keyPair ?? keyCache.get(address) ?? null) : null;
  return { keyPair: current, unlock };
}

export interface SubmitQueryParams {
  agentId: Hex;
  prompt: string;
  payment: bigint;
  ttlSeconds: number;
  /** Agent X25519 key; when set the prompt and answer are end-to-end encrypted */
  agentPublicKey?: string;
  replyKeyPair?: EncryptionKeyPair;
}

/** Creates a paid query on-chain and returns its ID once the transaction is mined */
export function useSubmitQuery() {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const mutation = useMutation({
    mutationFn: async (params: SubmitQueryParams): Promise<Hex> => {
      if (!publicClient) throw new Error('No RPC connection');

      const encrypted = !!params.agentPublicKey;
      if (encrypted && !params.replyKeyPair) throw new Error('Unlock your encryption key first');
      const queryData = encrypted
        ? encryptQuery(params.prompt, params.agentPublicKey as string, (params.replyKeyPair as EncryptionKeyPair).publicKey)
        : encodeText(params.prompt);

      const block = await publicClient.getBlock();
      const hash = await writeContractAsync({
        chainId: targetChain.id,
        address: CONTRACT_ADDRESSES.queryConsumer,
        abi: QUERY_CONSUMER_ABI,
        functionName: 'createQuery',
        args: [encrypted ? 'encrypted' : 'plaintext', queryData, block.timestamp + BigInt(params.ttlSeconds), [params.agentId]],
        value: params.payment,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Query transaction reverted');

      const [event] = parseEventLogs({ abi: QUERY_CONSUMER_ABI, logs: receipt.logs, eventName: 'QueryCreated' });
      if (!event) throw new Error('QueryCreated event not found');
      return event.args.queryId;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['readContract'] });
      void queryClient.invalidateQueries({ queryKey: ['readContracts'] });
    },
  });

  return { submitQuery: mutation.mutateAsync, isSubmitting: mutation.isPending, error: mutation.error };
}

/** Refunds the QueryConsumer could not push to the requester, withdrawable with `withdrawRefund` */
export function usePendingRefund(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.queryConsumer,
    abi: QUERY_CONSUMER_ABI,
    functionName: 'getPendingRefund',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

export interface QueryResponseDetail {
  agentId: Hex;
  responseData: Hex;
  submittedAt: bigint;
  /** Only known once the API has indexed the response */
  txHash: Hex | null;
}

export interface QueryDispatchDetail {
  agentId: Hex;
  status: 'pending' | 'relayed' | 'failed';
  attempts: number;
  lastError: string | null;
}

/** A query with everything known about it, from the API index or, before indexing, from the chain */
export interface QueryDetail extends QueryInfo {
  /** Cancelled by the requester; null when read from the chain, which does not record it */
  cancelled: boolean | null;
  aggregatedResult: Hex | null;
  finalizedAt: bigint | null;
  txHash: Hex | null;
  /** In submission order, the order the contract settles payouts in */
  responses: QueryResponseDetail[];
  /** Oracle delivery state per agent; null when read from the chain */
  dispatches: QueryDispatchDetail[] | null;
  source: 'api' | 'chain';
}

const API_STATUS: Record<ApiQuery['status'], QueryStatus> = {
  pending: QueryStatus.Pending,
  in_progress: QueryStatus.InProgress,
  completed: QueryStatus.Completed,
  failed: QueryStatus.Failed,
};

const toUnixSeconds = (iso: string) => BigInt(Math.floor(Date.parse(iso) / 1000));

function fromApi(query: ApiQueryDetail): QueryDetail {
  return {
    queryId: query.id,
    requester: query.requester,
    queryType: query.queryType,
    queryData: query.queryData,
    status: API_STATUS[query.status],
    createdAt: toUnixSeconds(query.createdAt),
    deadline: toUnixSeconds(query.deadline),
    payment: BigInt(query.payment),
    assignedAgents: query.assignedAgents,
    cancelled: query.cancelled,
    aggregatedResult: query.aggregatedResult,
    finalizedAt: query.finalizedAt ? toUnixSeconds(query.finalizedAt) : null,
    txHash: query.txHash,
    responses: query.responses.map((response) => ({ ...response, submittedAt: toUnixSeconds(response.submittedAt) })),
    dispatches: query.dispatches,
    source: 'api',
  };
}

const isSettled = (status: QueryStatus | undefined) => status === QueryStatus.Completed || status === QueryStatus.Failed;

/**
 * Full detail of one query. Reads the API index first; a query the indexer has not picked up yet
 * (for example one submitted seconds ago) is read straight from the QueryConsumer contract instead.
 */
export function useQueryDetail(queryId: Hex | undefined) {
  const indexed = useQuery({
    queryKey: ['query-detail', queryId],
    queryFn: () => api.getQuery(queryId as Hex),
    enabled: !!queryId,
    retry: (failureCount, error) => !(error instanceof ApiRequestError && error.status === 404) && failureCount < 2,
    // Keep polling until settled, which also picks the query up as soon as it is indexed
    refetchInterval: (query) => (isSettled(query.state.data ? API_STATUS[query.state.data.status] : undefined) ? false : 5000),
  });

  const notIndexed = indexed.error instanceof ApiRequestError && indexed.error.status === 404;
  const chainId = notIndexed ? queryId : undefined;
  const chainInfo = useQueryInfo(chainId);
  const chainResponses = useQueryResponses(chainId);
  const chainStatus = chainInfo.data?.status as QueryStatus | undefined;
  const { refetch: refetchChainResponses } = chainResponses;

  // Responses arrive while the query is open, so re-read them whenever the on-chain status moves
  useEffect(() => {
    if (chainStatus !== undefined) void refetchChainResponses();
  }, [chainStatus, refetchChainResponses]);

  const data = useMemo<QueryDetail | undefined>(() => {
    if (indexed.data) return fromApi(indexed.data);
    if (!notIndexed || !chainInfo.data) return undefined;
    const info = chainInfo.data;
    return {
      queryId: info.queryId,
      requester: info.requester,
      queryType: info.queryType,
      queryData: info.queryData,
      status: info.status as QueryStatus,
      createdAt: info.createdAt,
      deadline: info.deadline,
      payment: info.payment,
      assignedAgents: info.assignedAgents,
      cancelled: null,
      aggregatedResult: null,
      finalizedAt: null,
      txHash: null,
      responses: (chainResponses.data ?? []).map((response) => ({
        agentId: response.agentId,
        responseData: response.responseData,
        submittedAt: response.submittedAt,
        txHash: null,
      })),
      dispatches: null,
      source: 'chain',
    };
  }, [indexed.data, notIndexed, chainInfo.data, chainResponses.data]);

  const notFound = notIndexed && isQueryNotFoundRevert(chainInfo.error);
  const error = notFound ? null : notIndexed ? (data ? null : chainInfo.error) : indexed.data ? null : indexed.error;
  const isLoading = !data && !notFound && !error && !!queryId;

  return { data, isLoading, notFound, error };
}

/** Most recent queries assigned to an agent, newest first, from the indexer */
export function useAgentQueries(agentId: Hex | undefined, limit = 20) {
  return useQuery({
    queryKey: ['agentQueries', agentId, limit],
    queryFn: () => api.listQueries({ agentId, limit }),
    enabled: !!agentId,
    staleTime: 10_000,
  });
}
