// AMPM's ESLint flat config (docs/engineering/standards.md §2.2, .claude/rules/code.md). The root
// eslint.config.mjs re-exports it; every workspace's `lint` script is `eslint .`.
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

import { boundaries } from "./boundaries.mjs";

// Tailwind arbitrary values and properties: `w-[137px]`, `bg-[#333]`, `[mask-type:luminance]`, `[&>*]:p-2`.
// Any bracketed segment inside a class string is one; a missing step becomes a token instead (styling.md).
const ARBITRARY = String.raw`/\[[^\]\s]+\]/`;
const CLASS_ATTRIBUTE = "JSXAttribute[name.name=/[cC]lassName$/]";
const CLASS_CALL = "CallExpression[callee.name=/^(cn|cva|variants|clsx|twMerge)$/]";
const ARBITRARY_MESSAGE =
  "Arbitrary Tailwind values are forbidden (styling.md): add a token to packages/tokens instead.";

export const arbitraryValueSelectors = [
  { selector: `${CLASS_ATTRIBUTE} Literal[value=${ARBITRARY}]`, message: ARBITRARY_MESSAGE },
  {
    selector: `${CLASS_ATTRIBUTE} TemplateElement[value.raw=${ARBITRARY}]`,
    message: ARBITRARY_MESSAGE,
  },
  { selector: `${CLASS_CALL} Literal[value=${ARBITRARY}]`, message: ARBITRARY_MESSAGE },
  { selector: `${CLASS_CALL} TemplateElement[value.raw=${ARBITRARY}]`, message: ARBITRARY_MESSAGE },
];

export const hexColourSelector = {
  selector: "Literal[value=/^#[0-9a-fA-F]{3,8}$/]",
  message: "Hex colours live only in packages/tokens (styling.md); use a semantic class or token.",
};

const CODE = ["apps/**/*.{ts,tsx,js,mjs,cjs}", "packages/**/*.{ts,tsx,js,mjs,cjs}"];

export const ampm = defineConfig([
  globalIgnores([
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/.expo/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/expo-env.d.ts",
    "apps/api/src/generated/**",
    "docs/**",
    "vault/**",
    "graphify-out/**",
    "reference_docs/**",
  ]),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: CODE,
    plugins: { "import-x": importX, "react-hooks": reactHooks },
    rules: {
      // Code standards (code.md)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/ban-ts-comment": [
        "error",
        { "ts-expect-error": "allow-with-description" },
      ],
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      // React Native loads images and fonts with require(); everything else is an import
      "@typescript-eslint/no-require-imports": [
        "error",
        { allow: ["\\.(png|jpe?g|gif|webp|svg|ttf|otf|woff2?)$"] },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-console": "error",
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": [
        "warn",
        { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      "no-restricted-syntax": ["error", hexColourSelector, ...arbitraryValueSelectors],
      // Named exports only; routes and config files are the exceptions below
      "import-x/no-default-export": "error",
      "import-x/no-duplicates": "error",
      "import-x/first": "error",
      "import-x/newline-after-import": "error",
      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  ...boundaries,
  {
    // Node-run JavaScript: config files for Metro, Babel, Tailwind, Prettier, lefthook helpers
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.{js,cjs}"],
    languageOptions: { sourceType: "commonjs" },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Default exports where the framework demands them: Expo Router and Next.js route files, config files.
    files: [
      "apps/web/src/app/**/*.{ts,tsx}",
      "apps/mobile/src/app/**/*.{ts,tsx}",
      "**/*.config.{js,cjs,mjs,ts}",
      "**/*.config.*.{js,cjs,mjs,ts}",
    ],
    rules: { "import-x/no-default-export": "off" },
  },
  {
    // Expo's template components, constants and hooks stay until the UI foundation (bootstrap step 4)
    // replaces them with packages/ui; until then their default exports and template colours pass.
    files: ["apps/mobile/src/{components,constants,hooks}/**/*.{ts,tsx}"],
    rules: {
      "import-x/no-default-export": "off",
      "no-restricted-syntax": ["error", ...arbitraryValueSelectors],
    },
  },
  {
    // The tokens package is where colours are written down, and its generator talks on stdout.
    files: ["packages/tokens/**/*.ts"],
    rules: { "no-restricted-syntax": ["error", ...arbitraryValueSelectors] },
  },
  {
    files: ["packages/tokens/scripts/**/*.ts"],
    rules: { "no-console": "off" },
  },
  {
    // NestJS injects by the class named in a constructor parameter, read from decorator metadata at run
    // time, so an import that looks type-only to the linter is a value import. The fixer would break DI.
    files: ["apps/api/**/*.ts"],
    rules: { "@typescript-eslint/consistent-type-imports": "off" },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}", "**/test/**/*.ts"],
    rules: { "max-lines-per-function": "off", "no-console": "off" },
  },
  prettier,
]);
