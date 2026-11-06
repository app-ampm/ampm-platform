/**
 * tokens:build — writes dist/tailwind.preset.cjs, dist/tailwind.preset.web.cjs, their .d.cts types
 * and dist/tokens.css. Runs on Node's built-in type stripping (`node scripts/build.ts`, Node 24), so the
 * scripts use only erasable TypeScript and import their sources with explicit `.ts` extensions. The
 * content comes from scripts/generate.ts, which the tests exercise without touching the file system.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { generate } from "./generate.ts";

const { preset, webPreset, types, css } = generate();
const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, "tailwind.preset.cjs"), preset);
writeFileSync(join(dist, "tailwind.preset.web.cjs"), webPreset);
writeFileSync(join(dist, "tailwind.preset.d.cts"), types);
writeFileSync(join(dist, "tailwind.preset.web.d.cts"), types);
writeFileSync(join(dist, "tokens.css"), css);
console.log(
  `tokens: wrote tailwind.preset.cjs, tailwind.preset.web.cjs, their types and tokens.css to ${dist}`,
);
