/**
 * Synthetic seed (data.md): the nine roles with their permission keys from the policy package, a
 * Super Admin and a client representative with one project membership. Example-domain emails,
 * reserved phone range, local identity subjects. Never real people.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { permissionKeysForRole, STAFF_ROLE_CODES, STAFF_ROLES } from "@ampm/policy";

import { PrismaClient } from "../src/generated/prisma/client.js";

const url = process.env["DATABASE_URL"];
if (!url) throw new Error("DATABASE_URL is required to seed");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

export const SEED = {
  superAdmin: { email: "admin@example.com", name: "Asha Admin", subject: "local:admin" },
  projectManager: { email: "pm@example.com", name: "Priya Manager", subject: "local:pm" },
  client: { email: "client@example.com", name: "Rhea Client", subject: "local:client" },
  disabled: { email: "disabled@example.com", name: "Dev Disabled", subject: "local:disabled" },
  projectId: "0192f3a0-7d3e-7b1a-9c2f-0000000000a1",
} as const;

async function main(): Promise<void> {
  const roleIds = new Map<string, string>();
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
  const admin = await prisma.user.upsert({
    where: { email: SEED.superAdmin.email },
    update: { identitySubject: SEED.superAdmin.subject, status: "active" },
    create: {
      userType: "staff",
      name: SEED.superAdmin.name,
      email: SEED.superAdmin.email,
      phone: "+911234567001",
      status: "active",
      identitySubject: SEED.superAdmin.subject,
      mfaEnabled: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: roleIds.get("SA")! } },
    update: {},
    create: { userId: admin.id, roleId: roleIds.get("SA")! },
  });
  const pm = await prisma.user.upsert({
    where: { email: SEED.projectManager.email },
    update: { identitySubject: SEED.projectManager.subject, status: "active" },
    create: {
      userType: "staff",
      name: SEED.projectManager.name,
      email: SEED.projectManager.email,
      phone: "+911234567002",
      status: "active",
      identitySubject: SEED.projectManager.subject,
      mfaEnabled: true,
    },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: pm.id, roleId: roleIds.get("PM")! } },
    update: {},
    create: { userId: pm.id, roleId: roleIds.get("PM")! },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: SEED.projectId, userId: pm.id } },
    update: { status: "active" },
    create: {
      projectId: SEED.projectId,
      userId: pm.id,
      projectRole: "project_lead",
      status: "active",
      acceptedAt: new Date(),
    },
  });
  const client = await prisma.user.upsert({
    where: { email: SEED.client.email },
    update: { identitySubject: SEED.client.subject, status: "active" },
    create: {
      userType: "client",
      name: SEED.client.name,
      email: SEED.client.email,
      phone: "+911234567003",
      status: "active",
      identitySubject: SEED.client.subject,
    },
  });
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
  await prisma.user.upsert({
    where: { email: SEED.disabled.email },
    update: { identitySubject: SEED.disabled.subject, status: "disabled" },
    create: {
      userType: "staff",
      name: SEED.disabled.name,
      email: SEED.disabled.email,
      status: "disabled",
      identitySubject: SEED.disabled.subject,
    },
  });
  console.log("seeded roles, permissions and four synthetic accounts");
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
