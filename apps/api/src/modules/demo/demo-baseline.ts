import type { Prisma } from "../../generated/prisma/client.js";

/**
 * The synthetic demo baseline the nightly restore (feature 5.5) and the seed both build from, so the
 * demo data is defined in exactly one place (data.md). Today the only demo-scoped kernel entity is the
 * demo account; wedding-domain tables carrying `is_demo` / `demo_visible` are added as their own reset
 * specs in `demo-baseline.repository.ts` when they land.
 */

/** A fixed id (not generated) so the restore and the seed are idempotent and the demo identity is stable. */
export const DEMO_USER = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000d0",
  userType: "demo",
  name: "Dev Demo",
  // Example-domain email and a reserved phone range, never a real person (data.md).
  email: "demo@example.com",
  phone: "+911234567900",
  status: "active",
  identitySubject: "local:demo",
} as const;

/** The slice of a Prisma client the baseline writes through: the full client (seed) or a transaction. */
type DemoWriter = Pick<Prisma.TransactionClient, "user">;

/**
 * Upserts the canonical demo account to its baseline, keyed on the fixed id so running it again changes
 * nothing. Shared by the seed and the restore spec so the account is defined once.
 */
export async function upsertDemoUser(db: DemoWriter): Promise<void> {
  const { id, identitySubject, ...fields } = DEMO_USER;
  // The identity subject is set only on create, never on the nightly restore (B8): under Cognito the
  // demo account is linked to a real subject once, and overwriting it with the `local:demo` placeholder
  // every night would break its sign-in. `deletedAt: null` on update still resets a soft-deleted demo
  // account to baseline.
  await db.user.upsert({
    where: { id },
    update: { ...fields, deletedAt: null },
    create: { id, ...fields, identitySubject },
  });
}

/** One demo-scoped table's reset result: how many rows the guard cleared and how many baseline rows it wrote. */
export interface DemoTableRestore {
  readonly table: string;
  readonly deleted: number;
  readonly inserted: number;
}
