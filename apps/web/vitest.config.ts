import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // The `@/` alias from tsconfig.json, which Next resolves on its own.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // The end-to-end run's own support code is tested here too; its specs are Playwright's.
  test: { include: ["src/**/*.test.{ts,tsx}", "e2e/support/**/*.test.ts"], passWithNoTests: true },
});
