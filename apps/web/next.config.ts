import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shared packages ship TypeScript source; Next compiles them (docs/engineering/standards.md §2.2).
  transpilePackages: ["@ampm/tokens", "@ampm/ui", "@ampm/core", "@ampm/policy", "@ampm/api-client"],
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
