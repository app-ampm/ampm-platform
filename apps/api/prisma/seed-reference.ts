/**
 * The reference data every environment needs, production included (D-141): the nine roles with their
 * permission keys, the baseline configuration rows, the grantable-capability catalog, lead sources, the
 * subscription plans and the service types. No people, no hotels, no leads: the synthetic accounts and
 * demo data live in seed.ts, which refuses to run in production. Every write is an upsert, so it runs
 * again without duplicating anything, and a value the Super Admin has edited is never clobbered.
 *
 * @example
 * const roleIds = await seedReference(prisma); // roleIds.get("SA") -> the Super Admin role id
 */
import { CONFIG_REGISTRY } from "@ampm/core";
import {
  GRANTABLE_CAPABILITIES,
  permissionKeysForRole,
  STAFF_ROLE_CODES,
  STAFF_ROLES,
  type StaffRole,
} from "@ampm/policy";

import { Prisma, type PrismaClient, type ServiceCategory } from "../src/generated/prisma/client.js";

/** Seeds all reference data and returns the role ids by role code. */
export async function seedReference(db: PrismaClient): Promise<ReadonlyMap<StaffRole, string>> {
  const roleIds = await seedRoles(db);
  await seedConfigurations(db);
  await seedLeadSources(db);
  await seedPlans(db);
  await seedServiceTypes(db);
  await seedGrantableCapabilities(db);
  return roleIds;
}

/** The role id for a code from the map seedReference returned; throws when the role is missing. */
export function roleIdFor(roleIds: ReadonlyMap<StaffRole, string>, code: StaffRole): string {
  const id = roleIds.get(code);
  if (!id) throw new Error(`role ${code} was not seeded`);
  return id;
}

/** The nine roles with their permission keys from the policy package; role ids by code. */
async function seedRoles(db: PrismaClient): Promise<ReadonlyMap<StaffRole, string>> {
  const roleIds = new Map<StaffRole, string>();
  for (const code of STAFF_ROLE_CODES) {
    const { key, name } = STAFF_ROLES[code];
    const role = await db.role.upsert({
      where: { roleKey: key },
      update: { name },
      create: { roleKey: key, name, isSystem: true },
    });
    roleIds.set(code, role.id);
    for (const permissionKey of permissionKeysForRole(code)) {
      const permission = await db.permission.upsert({
        where: { permissionKey },
        update: {},
        create: { permissionKey },
      });
      await db.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
  return roleIds;
}

/** The baseline configuration rows from the registry; the Super Admin edits them later. */
async function seedConfigurations(db: PrismaClient): Promise<void> {
  for (const [configKey, { default: value }] of Object.entries(CONFIG_REGISTRY)) {
    await db.configuration.upsert({
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
async function seedGrantableCapabilities(db: PrismaClient): Promise<void> {
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
    await db.grantableCapability.upsert({
      where: { capabilityKey: capability.id },
      update: data,
      create: { capabilityKey: capability.id, ...data },
    });
  }
  const current = GRANTABLE_CAPABILITIES.map((capability) => capability.id);
  await db.grantableCapability.deleteMany({ where: { capabilityKey: { notIn: current } } });
}

/** The lead sources the enquiry form and the Sales workspace classify leads by (SA-editable reference). */
async function seedLeadSources(db: PrismaClient): Promise<void> {
  const sources: ReadonlyArray<{ sourceKey: string; name: string }> = [
    { sourceKey: "website", name: "Website" },
    { sourceKey: "instagram", name: "Instagram" },
    { sourceKey: "advertisement", name: "Advertisement" },
    { sourceKey: "referral", name: "Referral" },
    { sourceKey: "call", name: "Phone call" },
    { sourceKey: "other", name: "Other" },
  ];
  for (const source of sources) {
    await db.leadSource.upsert({
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
async function seedPlans(db: PrismaClient): Promise<void> {
  const plan = await db.plan.upsert({
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
    await db.planModule.upsert({
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
async function seedServiceTypes(db: PrismaClient): Promise<void> {
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
    await db.serviceType.upsert({
      where: { serviceKey: type.serviceKey },
      update: { name: type.name, category: type.category },
      create: { serviceKey: type.serviceKey, name: type.name, category: type.category },
    });
  }
}
