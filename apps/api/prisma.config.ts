import { defineConfig } from "prisma/config";

// Prisma 7 configuration. The connection URL comes from the environment (never committed; see
// .env.example). `prisma generate` and `prisma validate` need no database, so a placeholder keeps
// them working on a machine without one.
const PLACEHOLDER = "postgresql://ampm:ampm@localhost:5432/ampm";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --env-file-if-exists=.env prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"] ?? PLACEHOLDER,
  },
});
