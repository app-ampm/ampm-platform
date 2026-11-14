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
type DemoWriter = Pick<
  Prisma.TransactionClient,
  "user" | "leadSource" | "lead" | "clientAccount" | "accountContact"
>;

/**
 * The demo prospect's account, its `self` contact and its originating Sales lead — all on fixed ids so
 * the baseline stays idempotent. Two links make the P-7 demo work: the self contact's `user_id` resolves
 * the signed-in demo user to this account (`accountIdForUser`, so saved hotels persist here), and
 * `ClientAccount.lead_id` is where a demo hotel-assistance request lands as a Sales lead activity instead
 * of a no-op. The lead source must be seeded first (the seed orders it before this).
 */
export const DEMO_LEAD = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000d1",
  name: "Demo Prospect",
  sourceKey: "website",
} as const;
export const DEMO_ACCOUNT = {
  id: "0192f3a0-7d3e-7b1a-9c2f-0000000000d2",
  name: "Demo Prospect",
} as const;
export const DEMO_CONTACT = { id: "0192f3a0-7d3e-7b1a-9c2f-0000000000d3" } as const;

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

/**
 * Upserts the demo prospect's account, self contact and originating lead to their baseline (keyed on
 * fixed ids, so re-running changes nothing). Requires the demo user ([[upsertDemoUser]]) and the
 * `website` lead source to exist already. An owner (Sameer Sales) is attached when present so the
 * routed-to-Sales notification has a recipient; the activity lands regardless of the owner.
 */
export async function upsertDemoAccount(db: DemoWriter): Promise<void> {
  const source = await db.leadSource.findFirst({
    where: { sourceKey: DEMO_LEAD.sourceKey },
    select: { id: true },
  });
  if (!source) {
    throw new Error(`demo baseline: lead source "${DEMO_LEAD.sourceKey}" must be seeded first`);
  }
  const owner = await db.user.findFirst({
    where: { userType: "staff", email: "sales@example.com", status: "active", deletedAt: null },
    select: { id: true },
  });
  await db.lead.upsert({
    where: { id: DEMO_LEAD.id },
    update: { sourceId: source.id, ownerUserId: owner?.id ?? null },
    create: {
      id: DEMO_LEAD.id,
      sourceId: source.id,
      status: "demo_offered",
      name: DEMO_LEAD.name,
      requestedDemo: true,
      ownerUserId: owner?.id ?? null,
      createdBy: owner?.id ?? DEMO_USER.id,
    },
  });
  await db.clientAccount.upsert({
    where: { id: DEMO_ACCOUNT.id },
    update: { primaryContactUserId: DEMO_USER.id, leadId: DEMO_LEAD.id },
    create: {
      id: DEMO_ACCOUNT.id,
      name: DEMO_ACCOUNT.name,
      isDemo: true,
      status: "prospect",
      primaryContactUserId: DEMO_USER.id,
      leadId: DEMO_LEAD.id,
      createdBy: DEMO_USER.id,
    },
  });
  await db.accountContact.upsert({
    where: { id: DEMO_CONTACT.id },
    update: { userId: DEMO_USER.id },
    create: {
      id: DEMO_CONTACT.id,
      accountId: DEMO_ACCOUNT.id,
      name: DEMO_USER.name,
      relation: "self",
      email: DEMO_USER.email,
      isDecisionMaker: true,
      userId: DEMO_USER.id,
      createdBy: DEMO_USER.id,
    },
  });
}

/** One demo-scoped table's reset result: how many rows the guard cleared and how many baseline rows it wrote. */
export interface DemoTableRestore {
  readonly table: string;
  readonly deleted: number;
  readonly inserted: number;
}
