// Import boundaries the lint hook and CI enforce (docs/engineering/standards.md §2.2).
// apps → packages · ui → tokens, core · web-forms → ui/styles · api-client → core, policy · policy → core ·
// packages never import apps.
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

// The website's fields are plain DOM (D-175): the kit's class recipes come from `@ampm/ui/styles`, never
// from `@ampm/ui` itself, which is React Native. A regex, because a glob cannot re-admit a path under a
// refused one.
const PLAIN_DOM_MESSAGE =
  "web-forms is plain DOM: take the kit's recipes from @ampm/ui/styles, never React Native.";
const plainDomUi = { regex: "^@ampm/ui(?!/styles$)(/.*)?$", message: PLAIN_DOM_MESSAGE };
const plainDomNative = {
  group: ["react-native", "react-native-*", "nativewind", "expo", "expo-*"],
  message: PLAIN_DOM_MESSAGE,
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
    files: ["packages/web-forms/**/*.{ts,tsx}"],
    rules: restricted(noApps, noFrameworkRouting, presentational, plainDomUi, plainDomNative),
  },
  {
    // The shared Link is the one place expo-router is allowed in packages/ (the rule above says so).
    files: ["packages/ui/src/components/link/**/*.{ts,tsx}"],
    rules: restricted(noApps, presentational),
  },
  {
    files: ["apps/api/src/modules/**/*.ts"],
    rules: restricted({
      group: ["razorpay", "@aws-sdk/*", "twilio", "*/providers/*/sdk"],
      message: "Business logic never imports a provider SDK; use the adapter interface.",
    }),
  },
];
