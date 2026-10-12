'use client';

import { useQuery } from '@tanstack/react-query';
import type { Address, Hex } from 'viem';
import { api, type AgentMetadata, type ApiAgent } from '@/lib/api';

export type { AgentMetadata };

/**
 * Agents come from the Verora API, which indexes the on-chain registry and serves sanitized metadata
 * and health. The browser never fetches agent-controlled URLs directly.
 */
export interface Agent {
  agentId: Hex;
  owner: Address;
  endpoint: string;
  capabilities: string[];
  registeredAt: bigint;
  metadataURI: string;
  metadata: AgentMetadata | null;
  /** 0 - 10000 basis points */
  reputationScore: bigint;
  status: ApiAgent['status'];
  totalStake: bigint;
  stakerCount: number;
  totalQueries: number;
  successfulQueries: number;
  healthStatus: ApiAgent['healthStatus'];
  healthCheckedAt: string | null;
  failedQueries: number;
}

function toAgent(agent: ApiAgent): Agent {
  return {
    agentId: agent.id,
    owner: agent.owner,
    endpoint: agent.endpoint,
    capabilities: agent.capabilities,
    registeredAt: BigInt(Math.floor(new Date(agent.registeredAt).getTime() / 1000)),
    metadataURI: agent.metadataUri,
    metadata: agent.metadata,
    reputationScore: BigInt(agent.reputation),
    status: agent.status,
    totalStake: BigInt(agent.totalStake),
    stakerCount: agent.stakerCount,
    totalQueries: agent.totalQueries,
    successfulQueries: agent.successfulQueries,
    healthStatus: agent.healthStatus,
    healthCheckedAt: agent.healthCheckedAt,
    failedQueries: agent.failedQueries,
  };
}

/** Every indexed agent (the API caps pages at 100, so this pages through all of them) */
export function useAllAgents() {
  const query = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const agents: Agent[] = [];
      for (let page = 1; ; page++) {
        const result = await api.listAgents({ page, limit: 100 });
        agents.push(...result.data.map(toAgent));
        if (agents.length >= result.total || result.data.length === 0) return agents;
      }
    },
    staleTime: 15_000,
  });
  return { data: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

export function useAgent(agentId: Hex | undefined) {
  return useQuery({
    queryKey: ['agent', agentId],
    queryFn: async () => toAgent(await api.getAgent(agentId as Hex)),
    enabled: !!agentId,
    staleTime: 10_000,
  });
}

/** Network-wide query and agent totals from the indexer */
export function useNetworkStats() {
  return useQuery({
    queryKey: ['networkStats'],
    queryFn: () => api.getNetworkStats(),
    staleTime: 15_000,
  });
}
