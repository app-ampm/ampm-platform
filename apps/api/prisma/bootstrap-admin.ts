/**
 * The first Super Admin of a fresh production database (D-141). The account is created `invited`, holds
 * the Super Admin role and gets a single-use invite; its holder signs in with Cognito (whose verified
 * email must equal this one) and opens the activation link, which binds their Cognito subject (D-041).
 * It refuses once any Super Admin is active: from then on staff are invited from the app, so this
 * command can never mint an admin invite on a live system. Run through prisma/bootstrap.ts.
 *
 * @example
 * const outcome = await bootstrapSuperAdmin(prisma, { email, name, superAdminRoleId });
 * if (outcome.kind === "invited") deliver(`${WEB_APP_URL}/activate?token=${outcome.inviteToken}`);
 */
import type { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import { issueInviteToken } from "../src/identity/auth-token.service.js";

export interface BootstrapAdminInput {
  readonly email: string;
  readonly name: string;
  readonly phone?: string;
  /** The id of the Super Admin role (seed-reference.ts `roleIdFor(roleIds, "SA")`). */
  readonly superAdminRoleId: string;
}

export type BootstrapAdminOutcome =
  | {
      readonly kind: "invited";
      readonly userId: string;
      readonly inviteToken: string;
      readonly created: boolean;
    }
  | { readonly kind: "refused"; readonly reason: string };

/** Runs the bootstrap in its own transaction: the account, its role, its invite and the audit row commit together. */
export async function bootstrapSuperAdmin(
  db: PrismaClient,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminOutcome> {
  return db.$transaction((tx) => bootstrapSuperAdminIn(tx, input));
}

/**
 * The bootstrap inside a caller's transaction (the tests run it in one they roll back). An invited
 * account with the same email is re-invited: its earlier invite is retired and a fresh one issued, which
 * is how an expired link is replaced before activation.
 */
export async function bootstrapSuperAdminIn(
  tx: Prisma.TransactionClient,
  input: BootstrapAdminInput,
): Promise<BootstrapAdminOutcome> {
  const email = input.email.trim().toLowerCase();
  const check = await precheck(tx, email, input.superAdminRoleId);
  if (check.kind === "refused") return check;
  const existing = check.existingId;
  const userId = existing ?? (await createInvitedStaff(tx, { ...input, email }));
  await tx.userRole.upsert({
    where: { userId_roleId: { userId, roleId: input.superAdminRoleId } },
    update: {},
    create: { userId, roleId: input.superAdminRoleId },
  });
  const inviteToken = await issueInviteToken(tx, userId);
  // The platform's audit trail records who created the account: the system, from the bootstrap.
  await tx.auditEvent.create({
    data: {
      actorType: "system",
      action: existing ? "update" : "create",
      entityType: "user",
      entityId: userId,
      afterJson: { name: input.name, status: "invited", role: "SA", via: "bootstrap" },
    },
  });
  return { kind: "invited", userId, inviteToken, created: !existing };
}

/**
 * The two refusals: any active Super Admin, or the email already held by an account that is not an
 * invited staff member. Otherwise the id of the invited account to re-invite, if there is one.
 */
async function precheck(
  tx: Prisma.TransactionClient,
  email: string,
  superAdminRoleId: string,
): Promise<
  | { readonly kind: "refused"; readonly reason: string }
  | { readonly kind: "ok"; readonly existingId?: string }
> {
  const activeAdmin = await tx.user.findFirst({
    where: { status: "active", deletedAt: null, roles: { some: { roleId: superAdminRoleId } } },
    select: { id: true },
  });
  if (activeAdmin) {
    return {
      kind: "refused",
      reason: "a Super Admin is already active; invite further staff from the app",
    };
  }
  const existing = await tx.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" }, deletedAt: null },
    select: { id: true, status: true, userType: true },
  });
  if (!existing) return { kind: "ok" };
  if (existing.status !== "invited" || existing.userType !== "staff") {
    return {
      kind: "refused",
      reason: `that email already belongs to a ${existing.userType} account with status ${existing.status}`,
    };
  }
  return { kind: "ok", existingId: existing.id };
}

async function createInvitedStaff(
  tx: Prisma.TransactionClient,
  input: BootstrapAdminInput,
): Promise<string> {
  const user = await tx.user.create({
    data: {
      userType: "staff",
      name: input.name,
      email: input.email,
      status: "invited",
      // Staff sign in with a password and an authenticator code (R10); the Super Admin always enrols.
      mfaEnabled: true,
      ...(input.phone ? { phone: input.phone } : {}),
    },
    select: { id: true },
  });
  return user.id;
}
