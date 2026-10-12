# syntax=docker/dockerfile:1
# NEXT_PUBLIC_* values are inlined at build time, so pass them as build args for each environment.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
# The docs read each page's "Last updated" date from git history while they are prerendered,
# so the build stage needs git and the repository's .git directory (see .dockerignore).
RUN apk add --no-cache git
ARG NEXT_PUBLIC_CHAIN
ARG NEXT_PUBLIC_RPC_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
ARG NEXT_PUBLIC_QUERY_CONSUMER_ADDRESS
ARG NEXT_PUBLIC_STAKING_POOL_ADDRESS
ARG NEXT_PUBLIC_REPUTATION_MANAGER_ADDRESS
ARG NEXT_PUBLIC_PAYMENT_ROUTER_ADDRESS
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=4101
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 4101
CMD ["node", "server.js"]
