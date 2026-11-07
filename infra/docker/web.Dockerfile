# syntax=docker/dockerfile:1
# The public website's image (apps/web): Next.js's traced standalone server. The build stage repeats the
# server image's install steps line for line (infra/docker/Dockerfile), so when both images are built
# from the same source they share the install layer; the runtime stage carries only Next's standalone
# output (the server, the traced node_modules and the static assets) and runs as the non-root `node`
# user. Every page renders per request (D-046), so this is a Node server, not a static export.
ARG NODE_VERSION=24.22.1

FROM node:${NODE_VERSION}-bookworm-slim AS build
ENV CI=true
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile
# The workspace packages the site imports (@ampm/tokens' generated preset, @ampm/core, @ampm/policy).
RUN pnpm build --filter=web^...
# Next inlines NEXT_PUBLIC_* at build time, into the browser bundle and the CSP middleware alike, so the
# site's API and portal addresses are build arguments; the build refuses to run without them rather than
# baking in the localhost defaults. next/font downloads the fonts here, so the build needs the network.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_PORTAL_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN : "${NEXT_PUBLIC_API_URL:?the build arg NEXT_PUBLIC_API_URL is required}" \
      "${NEXT_PUBLIC_PORTAL_URL:?the build arg NEXT_PUBLIC_PORTAL_URL is required}" \
  && pnpm --filter web build \
  && mkdir -p apps/web/public

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
# HOSTNAME: Docker sets it to the container id, and the standalone server binds to it; 0.0.0.0 makes
# the server reachable on the published port and on localhost for the healthcheck.
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
WORKDIR /site
# Root-owned and read-only to the server; Next's only writes go to .next/cache (a tmpfs in Compose).
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
