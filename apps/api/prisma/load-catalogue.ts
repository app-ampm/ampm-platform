/**
 * Loads the starter hotel catalogue into a live database (D-159), and is safe to run again: it creates
 * the catalogue hotels (seed-catalogue.ts) that do not exist yet and never touches one that does, so the
 * Hotel team's later edits survive a re-run. It writes no people and no demo data, so unlike seed.ts it
 * may run in production. --dry-run reports what it would create and writes nothing. On the box:
 *
 *   docker compose -f … -f … --profile migrate run --rm -T migrate \
 *     node --import tsx prisma/load-catalogue.ts --dry-run
 *
 * Needs DATABASE_URL. The report goes to stdout.
 */
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { seedCatalogue } from "./seed-catalogue.js";

const { values } = parseArgs({ options: { "dry-run": { type: "boolean", default: false } } });
const isDryRun = values["dry-run"] ?? false;
const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const list = (slugs: readonly string[]): string => (slugs.length > 0 ? slugs.join(", ") : "none");

try {
  const outcome = await seedCatalogue(prisma, { dryRun: isDryRun });
  const verb = isDryRun ? "would create" : "created";
  process.stdout.write(
    `catalogue${isDryRun ? " (dry run, nothing written)" : ""}\n` +
      `  destinations ${verb}: ${list(outcome.destinationsCreated)}\n` +
      `  hotels ${verb}: ${list(outcome.hotelsCreated)}\n` +
      `  hotels already present, left alone: ${list(outcome.hotelsSkipped)}\n`,
  );
} finally {
  await prisma.$disconnect();
}
