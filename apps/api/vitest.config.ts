import { defineConfig } from "vitest/config";

/** Unit tests beside the code; the e2e suite has its own config and a database. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    root: "./",
    include: ["src/**/*.spec.ts"],
  },
});
