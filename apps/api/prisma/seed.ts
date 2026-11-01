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

import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { upsertDemoUser } from "../src/modules/demo/demo-baseline.js";

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

/** The Super Admin, the project's lead and creative, and a disabled account. */
async function seedStaff(roleIds: ReadonlyMap<StaffRole, string>): Promise<void> {
  const admin = await upsertAccount(SEED.superAdmin, {
    userType: "staff",
    phone: "+911234567001",
    mfaEnabled: true,
  });
  await assignRole(admin.id, roleId(roleIds, "SA"));
  const pm = await upsertAccount(SEED.projectManager, {
    userType: "staff",
    phone: "+911234567002",
    mfaEnabled: true,
  });
  await assignRole(pm.id, roleId(roleIds, "PM"));
  await joinProject(pm.id, "project_lead");
  const creative = await upsertAccount(SEED.creative, {
    userType: "staff",
    phone: "+911234567004",
  });
  await assignRole(creative.id, roleId(roleIds, "CD"));
  await joinProject(creative.id, "staff");
  const sales = await upsertAccount(SEED.sales, { userType: "staff", mfaEnabled: true });
  await assignRole(sales.id, roleId(roleIds, "SM"));
  await upsertAccount(SEED.disabled, { userType: "staff", status: "disabled" });
}

/** The client representative (bride's side) with finance view and approval rights on the project. */
async function seedClient(): Promise<void> {
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

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  await seedStaff(roleIds);
  await seedClient();
  // The canonical demo account, defined once in the demo baseline the nightly restore also rebuilds (5.5).
  await upsertDemoUser(prisma);
  await seedConfigurations();
  await seedLeadSources();
  await seedPlans();
  await seedGrantableCapabilities();
  console.log(
    "seeded roles, permissions, six synthetic accounts, the baseline configuration " +
      `and ${GRANTABLE_CAPABILITIES.length} grantable capabilities`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
