import { defineConfig } from "vitest/config";

// The parsers in scripts/ are tested next to them, against the literal cells of the document.
export default defineConfig({
  test: { include: ["src/**/*.test.ts", "scripts/**/*.test.ts"], passWithNoTests: true },
});
