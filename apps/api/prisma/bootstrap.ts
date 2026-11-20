/**
 * Production bootstrap (D-141), run after `prisma migrate deploy`, and safe to run again. It seeds the
 * reference data only (seed-reference.ts: roles, configuration, lead sources, plans, service types,
 * the capability catalog), never synthetic people or demo data, and with --super-admin-email it
 * invites the first Super Admin (bootstrap-admin.ts). The activation link is the only thing written to
 * stdout, so an operator can redirect it straight into a private file; progress goes to stderr:
 *
 *   node --import tsx prisma/bootstrap.ts \
 *     --super-admin-email you@ampmverse.com --super-admin-name "Your Name" > first-admin-link.txt
 *
 * Needs DATABASE_URL, and WEB_APP_URL to build the link.
 */
import { parseArgs } from "node:util";

import { PrismaPg } from "@prisma/adapter-pg";
import { z } from "zod";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { bootstrapSuperAdmin } from "./bootstrap-admin.js";
import { roleIdFor, seedReference } from "./seed-reference.js";

const args = z
  .object({
    "super-admin-email": z.string().email().optional(),
    "super-admin-name": z.string().trim().min(1).max(255).optional(),
    "super-admin-phone": z
      .string()
      .regex(/^\+[1-9]\d{6,14}$/, "E.164, e.g. +9198xxxxxxxx")
      .optional(),
  })
  .refine((a) => !a["super-admin-email"] || a["super-admin-name"], {
    message: "--super-admin-name is required with --super-admin-email",
  })
  .parse(
    parseArgs({
      options: {
        "super-admin-email": { type: "string" },
        "super-admin-name": { type: "string" },
        "super-admin-phone": { type: "string" },
      },
    }).values,
  );

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main(): Promise<void> {
  const roleIds = await seedReference(prisma);
  process.stderr.write("bootstrap: reference data seeded\n");
  const email = args["super-admin-email"];
  const name = args["super-admin-name"];
  if (!email || !name) return;
  const webAppUrl = z.string().url().parse(process.env["WEB_APP_URL"]);
  const outcome = await bootstrapSuperAdmin(prisma, {
    email,
    name,
    ...(args["super-admin-phone"] ? { phone: args["super-admin-phone"] } : {}),
    superAdminRoleId: roleIdFor(roleIds, "SA"),
  });
  if (outcome.kind === "refused") {
    process.stderr.write(`bootstrap: refused — ${outcome.reason}\n`);
    process.exitCode = 3;
    return;
  }
  process.stderr.write(
    `bootstrap: ${outcome.created ? "invited" : "re-invited"} the first Super Admin; ` +
      "the link is single-use and expires in 7 days\n",
  );
  process.stdout.write(`${webAppUrl}/activate?token=${encodeURIComponent(outcome.inviteToken)}\n`);
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
