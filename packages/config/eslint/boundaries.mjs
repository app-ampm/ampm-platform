// Import boundaries the lint hook and CI enforce (docs/engineering/standards.md §2.2).
// apps → packages · ui → tokens, core · api-client → core, policy · policy → core · packages never import apps.
export const boundaries = [
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['**/apps/**', '@ampm/web', '@ampm/mobile', '@ampm/api'],
          message: 'packages/ must never import from apps/.' },
        { group: ['next', 'next/*', 'expo-router', 'expo-router/*'],
          message: 'Framework imports stay in apps/ or behind the shared Link/Image components.' },
      ]}],
    },
  },
  {
    files: ['packages/core/**/*.ts', 'packages/tokens/**/*.ts', 'packages/policy/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['react', 'react-*', '@ampm/ui', '@ampm/api-client', '@prisma/*', '@nestjs/*'],
          message: 'core, tokens and policy must stay framework-free.' },
      ]}],
    },
  },
  {
    files: ['packages/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['@ampm/api-client', '@tanstack/*', 'zustand'],
          message: 'UI is presentational: data comes in through props.' },
      ]}],
    },
  },
  {
    files: ['apps/api/src/modules/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [
        { group: ['razorpay', '@aws-sdk/*', 'twilio', '*/providers/*/sdk'],
          message: 'Business logic never imports a provider SDK; use the adapter interface.' },
      ]}],
    },
  },
];
