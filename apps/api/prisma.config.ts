import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// Prisma 7 no longer reads .env by itself. Load apps/api/.env when it exists so `db:deploy`,
// `db:migrate` and `db:seed` reach the database it names; variables already in the environment (CI,
// the e2e set-up) win, because Node's loadEnvFile never overrides one that is set. The CLI runs with
// the app folder as its working directory, which is where the file lives.
if (existsSync(".env")) process.loadEnvFile(".env");

// `prisma generate` and `prisma validate` need no database, so a placeholder keeps them working on a
// machine without one.
const PLACEHOLDER = "postgresql://ampm:ampm@localhost:5432/ampm";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env --import tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? PLACEHOLDER,
  },
});
