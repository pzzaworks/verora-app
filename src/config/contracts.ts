import { isAddress, type Address } from 'viem';
import {
  agentRegistryAbi,
  paymentRouterAbi,
  queryConsumerAbi,
  reputationManagerAbi,
  stakingPoolAbi,
} from './abis';

/**
 * Contract addresses come from the build environment (see .env.example). There are deliberately no
 * fallbacks: a missing or malformed address fails loudly instead of silently pointing at another chain.
 * Each variable is referenced literally so Next.js can inline it at build time.
 */
function requireAddress(name: string, value: string | undefined): Address {
  if (!value || !isAddress(value)) {
    throw new Error(`${name} is not set to a valid contract address. Check the app environment.`);
  }
  return value;
}

export const CONTRACT_ADDRESSES = {
  agentRegistry: requireAddress('NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS', process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS),
  queryConsumer: requireAddress('NEXT_PUBLIC_QUERY_CONSUMER_ADDRESS', process.env.NEXT_PUBLIC_QUERY_CONSUMER_ADDRESS),
  staking: requireAddress('NEXT_PUBLIC_STAKING_POOL_ADDRESS', process.env.NEXT_PUBLIC_STAKING_POOL_ADDRESS),
  reputation: requireAddress('NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS', process.env.NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS),
  paymentRouter: requireAddress('NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS', process.env.NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS),
} as const;

export const AGENT_REGISTRY_ABI = agentRegistryAbi;
export const QUERY_CONSUMER_ABI = queryConsumerAbi;
export const STAKING_ABI = stakingPoolAbi;
export const REPUTATION_ABI = reputationManagerAbi;
export const PAYMENT_ROUTER_ABI = paymentRouterAbi;
