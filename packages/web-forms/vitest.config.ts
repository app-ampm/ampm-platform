import { defineConfig } from "vitest/config";

// The fields render to static markup (react-dom/server), as the site's own component tests do.
export default defineConfig({
  test: { include: ["src/**/*.test.{ts,tsx}"], passWithNoTests: true },
});
