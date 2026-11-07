import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared packages ship TypeScript source; Next compiles them (docs/engineering/standards.md §2.2).
  transpilePackages: ["@ampm/tokens", "@ampm/ui", "@ampm/core", "@ampm/policy", "@ampm/api-client"],
  // The server image (infra/docker/web.Dockerfile) runs Next's traced standalone server, not the whole
  // workspace. Every page renders per request (D-046), so the site needs a Node server, not a static
  // export. Tracing starts at the repository root so the workspace packages and the hoisted
  // node_modules are found.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // The repository's own rules (CLAUDE.md, .claude/rules) guide the agents; Next's generated AGENTS.md is not wanted.
  agentRules: false,
  // Static security headers (the per-request CSP + nonce are set in middleware.ts); HSTS is Caddy's.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
