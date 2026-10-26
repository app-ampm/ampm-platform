import { defineConfig } from "vitest/config";

// Pure modules only (cn, variants); component tests arrive with the UI foundation (bootstrap step 4).
export default defineConfig({
  test: { include: ["src/**/*.test.{ts,tsx}"], passWithNoTests: true },
});
