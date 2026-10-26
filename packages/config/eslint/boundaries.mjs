// Import boundaries the lint hook and CI enforce (docs/engineering/standards.md §2.2).
// apps → packages · ui → tokens, core · api-client → core, policy · policy → core · packages never import apps.
//
// Flat config replaces a rule's options with the last matching block instead of merging them, so each block
// below lists every pattern that applies to its files: the general package rules plus its own.

// A regex, not a glob: gitignore-style patterns do not match relative paths that climb out of the package.
const noApps = {
  regex: "(^|/)apps/|^(web|mobile|api)(/|$)",
  message: "packages/ must never import from apps/.",
};

const noFrameworkRouting = {
  group: ["next", "next/*", "expo-router", "expo-router/*"],
  message: "Framework imports stay in apps/ or behind the shared Link/Image components.",
};

const frameworkFree = {
  group: ["react", "react-*", "@ampm/ui", "@ampm/api-client", "@prisma/*", "@nestjs/*"],
  message: "core, tokens and policy must stay framework-free.",
};

const presentational = {
  group: ["@ampm/api-client", "@tanstack/*", "zustand"],
  message: "UI is presentational: data comes in through props.",
};

const restricted = (...patterns) => ({ "no-restricted-imports": ["error", { patterns }] });

export const boundaries = [
  {
    files: ["packages/**/*.{ts,tsx}"],
    rules: restricted(noApps, noFrameworkRouting),
  },
  {
    files: ["packages/core/**/*.ts", "packages/tokens/**/*.ts", "packages/policy/**/*.ts"],
    rules: restricted(noApps, noFrameworkRouting, frameworkFree),
  },
  {
    files: ["packages/ui/**/*.{ts,tsx}"],
    rules: restricted(noApps, noFrameworkRouting, presentational),
  },
  {
    files: ["apps/api/src/modules/**/*.ts"],
    rules: restricted({
      group: ["razorpay", "@aws-sdk/*", "twilio", "*/providers/*/sdk"],
      message: "Business logic never imports a provider SDK; use the adapter interface.",
    }),
  },
];
