/**
 * Synthetic seed (data.md): the nine roles with their permission keys from the policy package, a
 * Super Admin, and a project manager, a creative and a client representative who are members of
 * one project. Example-domain emails, reserved phone range, local identity subjects. Never real
 * people. Every write is an upsert, so the seed runs again without duplicating anything.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { permissionKeysForRole, STAFF_ROLE_CODES, STAFF_ROLES, type StaffRole } from "@ampm/policy";

import { PrismaClient } from "../src/generated/prisma/client.js";

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

/** Upserts a synthetic account by email; the identity subject is the local provider's. */
async function upsertAccount(account: Account, options: AccountOptions) {
  const status = options.status ?? "active";
  return prisma.user.upsert({
    where: { email: account.email },
    update: { identitySubject: account.subject, status },
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

async function main(): Promise<void> {
  const roleIds = await seedRoles();
  await seedStaff(roleIds);
  await seedClient();
  console.log("seeded roles, permissions and five synthetic accounts");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
