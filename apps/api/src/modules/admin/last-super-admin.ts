import { errors } from "@ampm/core";
import { STAFF_ROLES } from "@ampm/policy";

import type { PrismaService } from "../../db/prisma.service.js";

/** The `roles.role_key` of the Super Admin role; the one role that must never be fully removed. */
const SUPER_ADMIN_ROLE_KEY = STAFF_ROLES.SA.key;

const activeSuperAdmin = {
  status: "active" as const,
  deletedAt: null,
  roles: { some: { role: { roleKey: SUPER_ADMIN_ROLE_KEY, deletedAt: null } } },
};

/**
 * Refuses an operation that would leave no active Super Admin (B3): unassigning the Super Admin role
 * from, or disabling or deleting, the only remaining active Super Admin would lock the SA-only admin
 * surface out with no way back in. A no-op when the target is not an active Super Admin, or when
 * another active Super Admin remains. Call it before the mutation.
 */
export async function assertNotLastSuperAdmin(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  const targetIsActiveSuperAdmin = await prisma.user.count({
    where: { id: userId, ...activeSuperAdmin },
  });
  if (targetIsActiveSuperAdmin === 0) return;
  const others = await prisma.user.count({
    where: { id: { not: userId }, ...activeSuperAdmin },
  });
  if (others === 0) {
    throw errors.conflict(
      "The last Super Admin cannot be removed; assign the Super Admin role to another active user first",
    );
  }
}
