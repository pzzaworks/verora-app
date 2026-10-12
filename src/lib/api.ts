import type { Address, Hex } from 'viem';

/** Client for the Verora API (indexed chain data, SIWE sessions, metadata hosting) */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

export interface AgentMetadata {
  name?: string;
  description?: string;
  image?: string;
  banner?: string;
  publicKey?: string;
  website?: string;
}

export interface ApiAgent {
  id: Hex;
  owner: Address;
  endpoint: string;
  capabilities: string[];
  metadataUri: string;
  metadata: AgentMetadata | null;
  status: 'active' | 'suspended' | 'slashed' | 'inactive';
  adminSuspended: boolean;
  registeredAt: string;
  reputation: number;
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  totalStake: string;
  stakerCount: number;
  healthStatus: 'unknown' | 'healthy' | 'unhealthy';
  healthCheckedAt: string | null;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export interface StakePositionView {
  agentId: Hex;
  amount: string;
  shares: string;
  pendingRewards: string;
  unbondingAmount: string;
  withdrawableAmount: string;
  nextUnlockTime: number;
}

export interface AgentStakingStats {
  agentId: Hex;
  totalStaked: string;
  stakerCount: number;
  rewardsDistributed30d: string;
  apy: number;
}

export interface NetworkStats {
  totalQueries: number;
  completedQueries: number;
  failedQueries: number;
  openQueries: number;
  totalVolume: string;
  activeAgents: number;
  totalAgents: number;
}

export interface ApiQuery {
  id: Hex;
  requester: Address;
  queryType: string;
  queryData: Hex;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  cancelled: boolean;
  /** Wei, as a decimal string */
  payment: string;
  deadline: string;
  assignedAgents: Hex[];
  aggregatedResult: Hex | null;
  createdAt: string;
  finalizedAt: string | null;
  txHash: Hex;
}

export interface ApiQueryDetail extends ApiQuery {
  responses: Array<{ agentId: Hex; responseData: Hex; submittedAt: string; txHash: Hex }>;
  /** Oracle delivery of the query to each agent's endpoint */
  dispatches: Array<{ agentId: Hex; status: 'pending' | 'relayed' | 'failed'; attempts: number; lastError: string | null }>;
}

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new Error('NEXT_PUBLIC_API_URL is not configured');
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
  });
  const text = await response.text();
  const body: unknown = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = (body as { message?: string | string[] } | null)?.message;
    throw new ApiRequestError(response.status, Array.isArray(message) ? message.join('; ') : (message ?? response.statusText));
  }
  return body as T;
}

export const api = {
  listAgents: (params: { limit?: number; page?: number; status?: string; owner?: Address } = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
    return apiRequest<Paginated<ApiAgent>>(`/agents?${search.toString()}`);
  },
  getAgent: (agentId: Hex) => apiRequest<ApiAgent>(`/agents/${agentId}`),
  getAgentStaking: (agentId: Hex) => apiRequest<AgentStakingStats>(`/staking/agents/${agentId}`),
  getPositions: (address: Address) => apiRequest<StakePositionView[]>(`/staking/positions/${address.toLowerCase()}`),
  getNetworkStats: () => apiRequest<NetworkStats>('/queries/stats'),
  getQuery: (queryId: Hex) => apiRequest<ApiQueryDetail>(`/queries/${queryId.toLowerCase()}`),
  /** Indexed queries, newest first, optionally filtered by requester, assigned agent or status */
  listQueries: (params: { requester?: Address; agentId?: Hex; status?: ApiQuery['status']; page?: number; limit?: number } = {}) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
    return apiRequest<Paginated<ApiQuery>>(`/queries?${search.toString()}`);
  },
  getNonce: () => apiRequest<{ nonce: string }>('/auth/nonce'),
  verify: (message: string, signature: Hex) =>
    apiRequest<{ token: string; address: Address; expiresIn: number }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ message, signature }),
    }),
  uploadMetadata: (token: string, input: { name: string; description: string; publicKey?: string; website?: string; icon?: string; banner?: string }) =>
    apiRequest<{ id: string; uri: string }>('/metadata', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
    }),
};
