'use client';

import { useQuery } from '@tanstack/react-query';
import { useReadContract } from 'wagmi';
import type { Address, Hex } from 'viem';
import { CONTRACT_ADDRESSES, PAYMENT_ROUTER_ABI, STAKING_ABI } from '@/config/contracts';
import { api } from '@/lib/api';

export interface UserStakePosition {
  agentId: Hex;
  amount: bigint;
  pendingRewards: bigint;
  unbondingAmount: bigint;
  withdrawableAmount: bigint;
  nextUnlockTime: bigint;
}

/** Live position of a wallet on one agent (share-based: amounts reflect slashing) */
export function useUserPosition(agentId: Hex | undefined, address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.staking,
    abi: STAKING_ABI,
    functionName: 'getStake',
    args: agentId && address ? [agentId, address] : undefined,
    query: { enabled: !!agentId && !!address },
  });
}

export function useStakingParams() {
  const minimum = useReadContract({ address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'getMinimumStake' });
  const period = useReadContract({ address: CONTRACT_ADDRESSES.staking, abi: STAKING_ABI, functionName: 'getUnstakingPeriod' });
  return { minimumStake: minimum.data, unstakingPeriod: period.data };
}

/** Agent staking stats from the API, including the trailing 30-day APY */
export function useAgentStakingStats(agentId: Hex | undefined) {
  return useQuery({
    queryKey: ['agentStaking', agentId],
    queryFn: () => api.getAgentStaking(agentId as Hex),
    enabled: !!agentId,
    staleTime: 15_000,
  });
}

/** Every position of a wallet (agents come from the indexer, amounts are read live from the contract) */
export function useUserAllPositions(address: Address | undefined) {
  const query = useQuery({
    queryKey: ['positions', address],
    queryFn: async () =>
      (await api.getPositions(address as Address)).map<UserStakePosition>((position) => ({
        agentId: position.agentId,
        amount: BigInt(position.amount),
        pendingRewards: BigInt(position.pendingRewards),
        unbondingAmount: BigInt(position.unbondingAmount),
        withdrawableAmount: BigInt(position.withdrawableAmount),
        nextUnlockTime: BigInt(position.nextUnlockTime),
      })),
    enabled: !!address,
    staleTime: 10_000,
  });
  return { data: query.data ?? [], isLoading: query.isLoading, error: query.error, refetch: query.refetch };
}

/** Query fees an agent owner can withdraw */
export function usePendingFees(address: Address | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESSES.paymentRouter,
    abi: PAYMENT_ROUTER_ABI,
    functionName: 'getPendingFees',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/** How query payments are split between agent owners, stakers and the platform (basis points) */
export function useFeeSplit() {
  return useReadContract({
    address: CONTRACT_ADDRESSES.paymentRouter,
    abi: PAYMENT_ROUTER_ABI,
    functionName: 'getFeeSplit',
  });
}
