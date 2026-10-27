import { defineConfig } from "vitest/config";

/** Supertest against a disposable PostgreSQL (test-cases.md): DATABASE_URL_TEST, migrated and seeded once per run. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    root: "./",
    include: ["test/**/*.e2e-spec.ts"],
    setupFiles: ["test/setup.e2e.ts"],
    globalSetup: ["test/global-setup.e2e.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
