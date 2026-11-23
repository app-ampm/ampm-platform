import type { PrismaService } from "./prisma.service.js";

/*
 * Account resolution for the modules that act on a client's own account: the hotel shortlist, the
 * consultancy enquiries, the service agreements and the subscription portal. They read CRM tables
 * (account_contacts, client_accounts) from other modules — the recorded cross-module shortcut of D-063 —
 * so the queries live here once and cannot drift between them. Each repository keeps its own method and
 * delegates. PrincipalRepository resolves entitlements with its own lookup (no ordering); moving account
 * resolution onto the principal is still the intended end state.
 */

type AccountTables = Pick<PrismaService, "accountContact" | "clientAccount">;

/** The caller's own account, from their earliest live contact row; never from the request (security.md). */
export async function findAccountIdForUser(
  prisma: AccountTables,
  userId: string,
): Promise<string | null> {
  const contact = await prisma.accountContact.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
    select: { accountId: true },
  });
  return contact ? contact.accountId : null;
}

/** The client users (portal logins) on an account, for an entitlement-cache bust or a status notice. */
export async function findAccountClientUserIds(
  prisma: AccountTables,
  accountId: string,
): Promise<string[]> {
  const contacts = await prisma.accountContact.findMany({
    where: { accountId, userId: { not: null }, deletedAt: null },
    select: { userId: true },
  });
  return contacts.flatMap((contact) => (contact.userId ? [contact.userId] : []));
}

/** Whether a live (non-soft-deleted) client account exists, so a bad `account_id` is refused at the edge. */
export async function clientAccountExists(
  prisma: AccountTables,
  accountId: string,
): Promise<boolean> {
  const row = await prisma.clientAccount.findFirst({
    where: { id: accountId, deletedAt: null },
    select: { id: true },
  });
  return row !== null;
}
