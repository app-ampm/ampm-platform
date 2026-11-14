/**
 * Synthetic seed (data.md): the nine roles with their permission keys from the policy package, a
 * Super Admin, and a project manager, a creative and a client representative who are members of
 * one project. Example-domain emails, reserved phone range, local identity subjects. Never real
 * people. Every write is an upsert, so the seed runs again without duplicating anything.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { CONFIG_REGISTRY } from "@ampm/core";
import {
  GRANTABLE_CAPABILITIES,
  permissionKeysForRole,
  STAFF_ROLE_CODES,
  STAFF_ROLES,
  type StaffRole,
} from "@ampm/policy";

import { Prisma, PrismaClient, type ServiceCategory } from "../src/generated/prisma/client.js";
import { upsertDemoAccount, upsertDemoUser } from "../src/modules/demo/demo-baseline.js";
import { seedConsultancyDemo } from "./seed-consultancy.js";
import { seedHotels } from "./seed-hotels.js";
import { seedHotelSubresources } from "./seed-hotel-subresources.js";
import { seedLeads } from "./seed-leads.js";

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
  // Creative: create and read only on the wedding's incidents (permission-matrix §5.13 line 296).
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

/** The nine roles with their permission keys from the policy package; role ids by code. */
async function seedRoles(): Promise<ReadonlyMap<StaffRole, string>> {
  const roleIds = new Map<StaffRole, string>();
  for (const code of STAFF_ROLE_CODES) {
    const { key, name } = STAFF_ROLES[code];
    const role = await prisma.role.upsert({
      where: { roleKey: key },
      update: { name },
      create: { roleKey: key, name, isSystem: true },
    });
    roleIds.set(code, role.id);
    for (const permissionKey of permissionKeysForRole(code)) {
      const permission = await prisma.permission.upsert({
        where: { permissionKey },
        update: {},
        create: { permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  return roleIds;
}

function roleId(roleIds: ReadonlyMap<StaffRole, string>, code: StaffRole): string {
  const id = roleIds.get(code);
  if (!id) throw new Error(`role ${code} was not seeded`);
  return id;
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
    await assignRole(user.id, roleId(roleIds, role));
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

/** The baseline configuration rows from the registry; the Super Admin edits them later. */
async function seedConfigurations(): Promise<void> {
  for (const [configKey, { default: value }] of Object.entries(CONFIG_REGISTRY)) {
    await prisma.configuration.upsert({
      where: { configKey },
      // Re-seeding never clobbers a value the Super Admin has edited.
      update: {},
      create: { configKey, valueJson: value as Prisma.InputJsonValue, scope: "global" },
    });
  }
}

/**
 * The code-defined capability catalog (D-036) from @ampm/policy — the same set serialised to
 * packages/policy/src/generated/capabilities.json. Each capability is upserted by its stable key and
 * rows no longer in the catalog are removed, so the table mirrors the matrix. Dormant: nothing reads
 * it yet, and no `role_grants` reference it, so the reconciling delete is safe.
 */
async function seedGrantableCapabilities(): Promise<void> {
  for (const capability of GRANTABLE_CAPABILITIES) {
    const data = {
      module: capability.module,
      resource: capability.resource,
      action: capability.action,
      scope: capability.scope,
      conditions: [...capability.conditions] as Prisma.InputJsonValue,
      sourceRoles: [...capability.sourceRoles] as Prisma.InputJsonValue,
      isStaffOnly: capability.isStaffOnly,
      isEscalationLocked: capability.isEscalationLocked,
      label: capability.label,
    };
    await prisma.grantableCapability.upsert({
      where: { capabilityKey: capability.id },
      update: data,
      create: { capabilityKey: capability.id, ...data },
    });
  }
  const current = GRANTABLE_CAPABILITIES.map((capability) => capability.id);
  await prisma.grantableCapability.deleteMany({ where: { capabilityKey: { notIn: current } } });
}

/** The lead sources the enquiry form and the Sales workspace classify leads by (SA-editable reference). */
async function seedLeadSources(): Promise<void> {
  const sources: ReadonlyArray<{ sourceKey: string; name: string }> = [
    { sourceKey: "website", name: "Website" },
    { sourceKey: "instagram", name: "Instagram" },
    { sourceKey: "advertisement", name: "Advertisement" },
    { sourceKey: "referral", name: "Referral" },
    { sourceKey: "call", name: "Phone call" },
    { sourceKey: "other", name: "Other" },
  ];
  for (const source of sources) {
    await prisma.leadSource.upsert({
      where: { sourceKey: source.sourceKey },
      update: { name: source.name },
      create: { sourceKey: source.sourceKey, name: source.name },
    });
  }
}

/**
 * The v1 subscription catalogue (feature 8.3): the Hotel Discovery plan, Rs 50,000 one-time for one
 * month, granting hotel discovery and hotel assistance. The price is data in the `plans` reference
 * table, never a code literal (AC-02.9/AC-25.4) — the seed is the one place a currency amount appears.
 */
async function seedPlans(): Promise<void> {
  const plan = await prisma.plan.upsert({
    where: { planKey: "discovery" },
    update: {},
    create: {
      planKey: "discovery",
      name: "Hotel Discovery",
      planType: "hotel_discovery",
      billingType: "one_time",
      priceAmount: new Prisma.Decimal("50000.00"),
      currency: "INR",
      termDays: 30,
      isDemo: false,
      status: "active",
      termsVersion: "2026-11",
    },
    select: { id: true },
  });
  for (const moduleKey of ["hotel_discovery", "hotel_assistance"]) {
    await prisma.planModule.upsert({
      where: { planId_moduleKey: { planId: plan.id, moduleKey } },
      update: { accessLevel: "full" },
      create: { planId: plan.id, moduleKey, accessLevel: "full" },
    });
  }
}

/**
 * The v1 service-type catalogue (feature 10.2, GP-5): the paid services beyond the subscription. A
 * reference table (Super-Admin editable, data.md §1); `service_key` is the stable business key and
 * `category` maps to the entitlement module. The hotel-assistance pipeline keys are seeded now; the
 * design / vendor / full-management services are stubbed for the categories their modules will build.
 */
async function seedServiceTypes(): Promise<void> {
  const types: ReadonlyArray<{ serviceKey: string; name: string; category: ServiceCategory }> = [
    { serviceKey: "availability_check", name: "Availability check", category: "hotel_assistance" },
    { serviceKey: "negotiation", name: "Rate negotiation", category: "hotel_assistance" },
    { serviceKey: "site_visit", name: "Site visit", category: "hotel_assistance" },
    { serviceKey: "contract_review", name: "Contract review", category: "hotel_assistance" },
    { serviceKey: "booking_assistance", name: "Booking assistance", category: "hotel_assistance" },
    { serviceKey: "design", name: "Design", category: "design" },
    {
      serviceKey: "vendor_coordination",
      name: "Vendor coordination",
      category: "vendor_coordination",
    },
    { serviceKey: "full_management", name: "Full management", category: "full_management" },
  ];
  for (const type of types) {
    await prisma.serviceType.upsert({
      where: { serviceKey: type.serviceKey },
      update: { name: type.name, category: type.category },
      create: { serviceKey: type.serviceKey, name: type.name, category: type.category },
    });
  }
}

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  await seedStaff(roleIds);
  const clientUserId = await seedClient();
  await seedPortalDemoClient();
  // The canonical demo account, defined once in the demo baseline the nightly restore also rebuilds (5.5).
  await upsertDemoUser(prisma);
  await seedConfigurations();
  await seedLeadSources();
  await seedLeads(prisma);
  // The demo prospect's account, self contact and originating lead — after the demo user, the lead
  // source and Sales staff exist, so saved hotels persist and assistance routes to the lead (P-7).
  await upsertDemoAccount(prisma);
  await seedPlans();
  await seedServiceTypes();
  await seedHotels(prisma);
  // Venues, rooms and a verified client-visible rate card per hotel, so discovery renders with real figures.
  await seedHotelSubresources(prisma);
  // Depends on the discovery plan, the negotiation service type and the Lake Pavilion hotel seeded above.
  await seedConsultancyDemo(prisma, clientUserId);
  await seedGrantableCapabilities();
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
