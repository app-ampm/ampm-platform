import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // The `@/` alias from tsconfig.json, which Next resolves on its own.
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.{ts,tsx}"], passWithNoTests: true },
});
