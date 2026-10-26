import { defineConfig, env } from "prisma/config";

// Prisma 7 configuration: the connection URL comes from the environment (never committed; see .env.example).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
