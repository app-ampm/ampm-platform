# syntax=docker/dockerfile:1
# The single AMPM server image (vps-setup.md §1, D-048): one build runs `api` (REST + WebSocket) or
# `worker` (jobs, webhooks, retention) by command, and the same image runs `prisma migrate deploy` for
# the deploy migration job (feature 6.6). Multi-stage: the build layer installs and compiles the whole
# workspace; the runtime layer carries the result and runs as the non-root `node` user.
ARG NODE_VERSION=24.22.1

FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# Generate the Prisma client, then let Turbo build the API and the workspace packages it depends on
# (turbo.json `build` has dependsOn ^build, so @ampm/core, @ampm/policy, … build first).
RUN pnpm db:generate
RUN pnpm build --filter=api

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ENV NODE_ENV=production
# The whole built workspace: with the hoisted pnpm linker node_modules is a flat tree, so copying it
# with the compiled dist (including dist/generated/prisma) yields a runnable image. Trimming to
# production-only dependencies (pnpm deploy / distroless) is a later optimisation (D-048).
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
USER node
EXPOSE 3900
# The API by default. Compose overrides the command for the worker (node dist/worker.js) and for the
# feature-6.6 migration job — which invokes the Prisma CLI by explicit path, since corepack/pnpm are not
# enabled in this stage and the hoisted bin is not on PATH from this WORKDIR:
#   node /repo/node_modules/.bin/prisma migrate deploy   (run from /repo/apps/api so the schema resolves)
CMD ["node", "dist/main.js"]
