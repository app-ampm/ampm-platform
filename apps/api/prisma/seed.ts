/**
 * Synthetic seed (data.md) for development, the e2e tests and the test stack: on top of the reference
 * data (seed-reference.ts), a Super Admin, a project manager, a creative and a client representative
 * who are members of one project, plus demo hotels, leads and the consultancy demo. Example-domain
 * emails, reserved phone range, local identity subjects. Never real people. Every write is an upsert,
 * so the seed runs again without duplicating anything. It refuses to run in production (D-141), where
 * prisma/bootstrap.ts seeds the reference data and invites the first Super Admin instead.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { GRANTABLE_CAPABILITIES, type StaffRole } from "@ampm/policy";

import { PrismaClient } from "../src/generated/prisma/client.js";
import { upsertDemoAccount, upsertDemoUser } from "../src/modules/demo/demo-baseline.js";
import { seedConsultancyDemo } from "./seed-consultancy.js";
import { seedHotels } from "./seed-hotels.js";
import { seedHotelSubresources } from "./seed-hotel-subresources.js";
import { seedLeads } from "./seed-leads.js";
import { roleIdFor, seedReference } from "./seed-reference.js";

if (process.env["NODE_ENV"] === "production") {
  throw new Error(
    "seed.ts creates synthetic accounts and demo data and never runs in production; " +
      "use prisma/bootstrap.ts there (D-141)",
  );
}
const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required to seed");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/**
 * The synthetic accounts and the project they belong to; `subject` is what `dev:token` mints.
 *
 * @example
 * SEED.creative.subject; // "local:cd"
 */
export const SEED = {
  superAdmin: { email: "admin@example.com", name: "Asha Admin", subject: "local:admin" },
  projectManager: { email: "pm@example.com", name: "Priya Manager", subject: "local:pm" },
  // Creative: create and read only on the wedding's incidents (permission-matrix §5.13 line 298).
  creative: { email: "creative@example.com", name: "Chitra Creative", subject: "local:cd" },
  sales: { email: "sales@example.com", name: "Sameer Sales", subject: "local:sm" },
  // Hotel / Destination team: drives the hotel-enquiry pipeline's early stages (the SA cannot) — Slice 3.
  hotelTeam: { email: "hotel@example.com", name: "Hema Hotels", subject: "local:ht" },
  // Finance / Accounts: subscriptions, the payment ledger and billing (permission-matrix §5.2, FA).
  finance: { email: "finance@example.com", name: "Farah Finance", subject: "local:fa" },
  client: { email: "client@example.com", name: "Rhea Client", subject: "local:client" },
  disabled: { email: "disabled@example.com", name: "Dev Disabled", subject: "local:disabled" },
  projectId: "0192f3a0-7d3e-7b1a-9c2f-0000000000a1",
} as const;

interface Account {
  readonly email: string;
  readonly name: string;
  readonly subject: string;
}

interface AccountOptions {
  readonly userType: "staff" | "client";
  readonly status?: "active" | "disabled";
  readonly phone?: string;
  readonly mfaEnabled?: boolean;
}

/** Upserts a synthetic account by its identity subject; email is no longer a unique key (B9). */
async function upsertAccount(account: Account, options: AccountOptions) {
  const status = options.status ?? "active";
  return prisma.user.upsert({
    where: { identitySubject: account.subject },
    update: { email: account.email, name: account.name, status },
    create: {
      userType: options.userType,
      name: account.name,
      email: account.email,
      status,
      identitySubject: account.subject,
      ...(options.phone ? { phone: options.phone } : {}),
      ...(options.mfaEnabled ? { mfaEnabled: true } : {}),
    },
  });
}

async function assignRole(userId: string, roleId: string): Promise<void> {
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
}

/** An active staff membership of the seeded project. */
async function joinProject(userId: string, projectRole: "project_lead" | "staff"): Promise<void> {
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: SEED.projectId, userId } },
    update: { status: "active" },
    create: {
      projectId: SEED.projectId,
      userId,
      projectRole,
      status: "active",
      acceptedAt: new Date(),
    },
  });
}

/** The Super Admin, the project lead and creative, Sales, the Hotel team, Finance, and a disabled account. */
async function seedStaff(roleIds: ReadonlyMap<StaffRole, string>): Promise<void> {
  const member = async (
    account: Account,
    role: StaffRole,
    options: Omit<AccountOptions, "userType"> = {},
  ): Promise<string> => {
    const user = await upsertAccount(account, { userType: "staff", ...options });
    await assignRole(user.id, roleIdFor(roleIds, role));
    return user.id;
  };
  await member(SEED.superAdmin, "SA", { phone: "+911234567001", mfaEnabled: true });
  const pm = await member(SEED.projectManager, "PM", { phone: "+911234567002", mfaEnabled: true });
  await joinProject(pm, "project_lead");
  await joinProject(await member(SEED.creative, "CD", { phone: "+911234567004" }), "staff");
  await member(SEED.sales, "SM", { mfaEnabled: true });
  await member(SEED.hotelTeam, "HT", { mfaEnabled: true });
  await member(SEED.finance, "FA", { mfaEnabled: true });
  await upsertAccount(SEED.disabled, { userType: "staff", status: "disabled" });
}

/** The client representative (bride's side) with finance view and approval rights on the project. */
async function seedClient(): Promise<string> {
  const client = await upsertAccount(SEED.client, { userType: "client", phone: "+911234567003" });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: SEED.projectId, userId: client.id } },
    update: { status: "active" },
    create: {
      projectId: SEED.projectId,
      userId: client.id,
      projectRole: "client_representative",
      clientSide: "bride",
      canViewFinance: true,
      canApprove: true,
      status: "active",
      acceptedAt: new Date(),
    },
  });
  return client.id;
}

/**
 * An active prospect client for the portal demo (CP-11): an account-contact on a prospect account with
 * NO subscription and NO project membership, so their entitlements start empty (hotel discovery locked)
 * and the subscription purchase is what opens it. Distinct from Rhea, whose project membership already
 * grants project-scoped discovery.
 */
async function seedPortalDemoClient(): Promise<void> {
  const user = await upsertAccount(
    { email: "prospect@example.com", name: "Prasad Prospect", subject: "local:prospect" },
    { userType: "client", phone: "+911234567010" },
  );
  const account = await prisma.clientAccount.upsert({
    where: { id: "0192f3a0-7d3e-7b1a-9c2f-0000000000c1" },
    update: { primaryContactUserId: user.id },
    create: {
      id: "0192f3a0-7d3e-7b1a-9c2f-0000000000c1",
      name: "Prasad & Partner",
      status: "prospect",
      primaryContactUserId: user.id,
      createdBy: user.id,
    },
    select: { id: true },
  });
  await prisma.accountContact.upsert({
    where: { id: "0192f3a0-7d3e-7b1a-9c2f-0000000000c2" },
    update: { userId: user.id },
    create: {
      id: "0192f3a0-7d3e-7b1a-9c2f-0000000000c2",
      accountId: account.id,
      name: user.name,
      relation: "self",
      email: user.email,
      isDecisionMaker: true,
      userId: user.id,
      createdBy: user.id,
    },
  });
}

async function main(): Promise<void> {
  // Roles, configuration, lead sources, plans, service types and the capability catalog first: the
  // synthetic accounts, leads and the consultancy demo below depend on them.
  const roleIds = await seedReference(prisma);
  await seedStaff(roleIds);
  const clientUserId = await seedClient();
  await seedPortalDemoClient();
  // The canonical demo account, defined once in the demo baseline the nightly restore also rebuilds (5.5).
  await upsertDemoUser(prisma);
  await seedLeads(prisma);
  // The demo prospect's account, self contact and originating lead — after the demo user, the lead
  // source and Sales staff exist, so saved hotels persist and assistance routes to the lead (P-7).
  await upsertDemoAccount(prisma);
  await seedHotels(prisma);
  // Venues, rooms and a verified client-visible rate card per hotel, so discovery renders with real figures.
  await seedHotelSubresources(prisma);
  // Depends on the discovery plan, the negotiation service type and the Lake Pavilion hotel seeded above.
  await seedConsultancyDemo(prisma, clientUserId);
  console.log(
    "seeded roles, permissions, eight synthetic accounts, four synthetic hotels, Rhea's hotel " +
      `consultancy demo, the baseline configuration and ${GRANTABLE_CAPABILITIES.length} grantable capabilities`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
