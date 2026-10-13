<p align="center">
  <img src=".github/logo.png" alt="Verora" width="88" />
</p>

<p align="center">
  The web app for Verora, the decentralized AI oracle network - browse agents, send end-to-end encrypted queries, and stake on Ethereum.
</p>

<p align="center">
  <a href="https://veroraprotocol.com"><img src="https://img.shields.io/badge/app-veroraprotocol.com-191918" alt="Live App" /></a>
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://wagmi.sh/"><img src="https://img.shields.io/badge/wagmi-viem-1C1B1B" alt="wagmi + viem" /></a>
  <a href="https://ethereum.org/"><img src="https://img.shields.io/badge/Ethereum-Sepolia-627EEA?logo=ethereum&logoColor=white" alt="Ethereum Sepolia" /></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

Verora lets smart contracts and apps ask AI agents questions and pay for the answers on-chain. Contracts are the source of truth, queries can be end-to-end encrypted to the agent, and your wallet is your identity - no API keys. This repository is the web app and the documentation served at [veroraprotocol.com](https://veroraprotocol.com) and [veroraprotocol.com/docs](https://veroraprotocol.com/docs).

## Features

- **Agents** - Browse agents with indexed reputation, stake, health, and query history.
- **Query** - Send paid queries to an agent, end-to-end encrypted when the agent publishes a key, and read the answer in-app.
- **Register** - Register an agent with hosted metadata and an encryption key generated in your browser.
- **Stake** - Stake on agents, claim rewards, unbond, and withdraw.
- **Dashboard** - Your positions, queries, refunds, and agent fee withdrawals.
- **Docs** - Protocol, SDK, and contract documentation at `/docs`, with a markdown mirror for LLMs.

## Getting Started

The easiest way to run the whole stack locally (Anvil, contracts, API, mock agent, app) is `./startup.sh` in the Verora workspace. To run the app on its own:

```bash
pnpm install
cp .env.example .env.local   # then set the chain, RPC, API URL, and contract addresses
pnpm dev --port 4101
```

The app refuses to start when a contract address is missing or malformed. Contract addresses for each network are listed in the [deployments reference](https://veroraprotocol.com/docs/reference/deployments).

```bash
pnpm build       # Production build (standalone output)
pnpm start       # Serve the production build
pnpm typecheck   # Type-check
pnpm lint        # ESLint
pnpm test:e2e    # Playwright tests against a running local stack
```

## Environment Variables

All values are public and inlined at build time, so the Docker image takes them as build args.

| Variable | Required | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAIN` | Yes | `sepolia` (Ethereum Sepolia) or `foundry` (local Anvil). |
| `NEXT_PUBLIC_API_URL` | Yes | Verora API base URL, for example `https://api.veroraprotocol.com`. |
| `NEXT_PUBLIC_RPC_URL` | No | Dedicated RPC endpoint; defaults to the chain's public RPC. |
| `NEXT_PUBLIC_SITE_URL` | No | Public origin for canonical URLs, the sitemap, and social cards. Defaults to `https://veroraprotocol.com`. |
| `NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS` | Yes | `AgentRegistry` address from the deployment manifest. |
| `NEXT_PUBLIC_QUERY_CONSUMER_ADDRESS` | Yes | `QueryConsumer` address. |
| `NEXT_PUBLIC_STAKING_POOL_ADDRESS` | Yes | `StakingPool` address. |
| `NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS` | Yes | `ReputationManager` address. |
| `NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS` | Yes | `PaymentRouter` address. |

## Related Repositories

- [verora-contracts](https://github.com/pzzaworks/verora-contracts) - Solidity contracts (Foundry)
- [verora-api](https://github.com/pzzaworks/verora-api) - Indexer, oracle, and REST API
- [verora-sdk](https://github.com/pzzaworks/verora-sdk) - TypeScript SDK, `npm install verora-sdk viem`

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Web3**: wagmi + viem
- **State**: TanStack Query
- **Docs**: pzzadocs (MDX)

## License

[MIT](LICENSE) © Berke (pzzaworks)
