import { execSync } from "node:child_process";

import { loadDotEnv } from "./dotenv.js";

/** Migrates and seeds the disposable test database once per run (test-cases.md: synthetic seed only). */
export function setup(): void {
  loadDotEnv();
  const url = process.env["DATABASE_URL_TEST"];
  if (!url) throw new Error("DATABASE_URL_TEST is required for the e2e tests");
  const env = { ...process.env, DATABASE_URL: url };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });
  execSync("node --import tsx prisma/seed.ts", { env, stdio: "inherit" });
}
