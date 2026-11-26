import { Injectable } from "@nestjs/common";
import { STAFF_ROLES, type StaffRole } from "@ampm/policy";

import { PrismaService } from "../../../db/prisma.service.js";

/** Who the Hotel team's alerts go to: the Super Admin and the Hotel team (D-177, D-189 §3, D-190 §4). */
export const HOTEL_TEAM_ALERT_ROLES: readonly StaffRole[] = ["SA", "HT"];

/** Who a contributor's withdrawal or removal request goes to: the Super Admins (D-190 §4). */
export const SUPER_ADMIN_ALERT_ROLES: readonly StaffRole[] = ["SA"];

/**
 * The one query every staff alert reads its recipients with (D-190 §4): the disk check (D-177), the hotel
 * form's SMS cap (D-189 §3), and the form's submit, correction and withdrawal notices. Module A, which owns
 * the users and their roles, so no other module queries those tables for it.
 */
@Injectable()
export class StaffAlertRecipients {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The active, undeleted staff users who hold any of `roles` (a role not deleted), oldest account first.
   *
   * @example
   * const recipients = await staffAlertRecipients.ids(HOTEL_TEAM_ALERT_ROLES);
   */
  async ids(roles: readonly StaffRole[]): Promise<string[]> {
    if (roles.length === 0) return [];
    const roleKeys: string[] = roles.map((role) => STAFF_ROLES[role].key);
    const users = await this.prisma.user.findMany({
      where: {
        userType: "staff",
        status: "active",
        deletedAt: null,
        roles: { some: { role: { roleKey: { in: roleKeys }, deletedAt: null } } },
      },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    return users.map((user) => user.id);
  }
}
