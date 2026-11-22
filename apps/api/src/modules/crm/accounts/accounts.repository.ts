import { Injectable } from "@nestjs/common";
import type { ClientAccountStatus } from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";

/**
 * A client account as staff read it. Billing fields (RESTRICTED-BANK) are deliberately never selected
 * here — a Finance-facing model reads them in the finance increment — so they cannot leak through this
 * path. `internalNotes` (RESTRICTED-NOTES) is staff-only and never serialised to a client (security.md).
 */
export interface AccountRow {
  readonly id: string;
  readonly name: string;
  readonly coupleNames: string | null;
  readonly brideName: string | null;
  readonly brideFatherName: string | null;
  readonly groomName: string | null;
  readonly groomFatherName: string | null;
  readonly preferredLocations: string | null;
  readonly isDemo: boolean;
  readonly status: ClientAccountStatus;
  readonly primaryContactUserId: string | null;
  readonly leadId: string | null;
  readonly internalNotes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface AccountContactRow {
  readonly id: string;
  readonly accountId: string;
  readonly name: string;
  readonly relation: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly isDecisionMaker: boolean;
  readonly userId: string | null;
  readonly createdAt: Date;
}

export interface AccountDetailRow extends AccountRow {
  readonly contacts: AccountContactRow[];
}

export interface AccountWriteData {
  readonly name: string;
  readonly coupleNames: string | null;
  readonly brideName: string | null;
  readonly groomName: string | null;
  readonly preferredLocations: string | null;
  readonly status: ClientAccountStatus;
  readonly isDemo: boolean;
  readonly primaryContactUserId: string | null;
  readonly leadId: string;
  readonly createdBy: string;
}

export interface AccountContactWriteData {
  readonly accountId: string;
  readonly name: string;
  readonly relation: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly isDecisionMaker: boolean;
  /** The contact's portal login; null for a contact who has none (yet). */
  readonly userId: string | null;
  readonly createdBy: string;
}

/** The contact fields the hub may change, plus the login an invite attaches; a key left out stays. */
export interface AccountContactPatch {
  readonly name?: string;
  readonly relation?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly isDecisionMaker?: boolean;
  readonly userId?: string;
}

/** The account fields the hub may change (TW-13); a key left out is left as it is. */
export interface AccountPatch {
  readonly name?: string;
  readonly coupleNames?: string | null;
  readonly brideName?: string | null;
  readonly brideFatherName?: string | null;
  readonly groomName?: string | null;
  readonly groomFatherName?: string | null;
  readonly preferredLocations?: string | null;
  readonly internalNotes?: string | null;
}

export interface AccountListFilters {
  readonly status?: ClientAccountStatus | undefined;
  readonly q?: string | undefined;
}

const ACCOUNT_FIELDS = {
  id: true,
  name: true,
  coupleNames: true,
  brideName: true,
  brideFatherName: true,
  groomName: true,
  groomFatherName: true,
  preferredLocations: true,
  isDemo: true,
  status: true,
  primaryContactUserId: true,
  leadId: true,
  internalNotes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const CONTACT_FIELDS = {
  id: true,
  accountId: true,
  name: true,
  relation: true,
  phone: true,
  email: true,
  isDecisionMaker: true,
  userId: true,
  createdAt: true,
} as const;

type SelectedAccount = Prisma.ClientAccountGetPayload<{ select: typeof ACCOUNT_FIELDS }>;
type SelectedContact = Prisma.AccountContactGetPayload<{ select: typeof CONTACT_FIELDS }>;

function toAccountRow(account: SelectedAccount): AccountRow {
  return {
    id: account.id,
    name: account.name,
    coupleNames: account.coupleNames,
    brideName: account.brideName,
    brideFatherName: account.brideFatherName,
    groomName: account.groomName,
    groomFatherName: account.groomFatherName,
    preferredLocations: account.preferredLocations,
    isDemo: account.isDemo,
    status: account.status,
    primaryContactUserId: account.primaryContactUserId,
    leadId: account.leadId,
    internalNotes: account.internalNotes,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

function toContactRow(contact: SelectedContact): AccountContactRow {
  return {
    id: contact.id,
    accountId: contact.accountId,
    name: contact.name,
    relation: contact.relation,
    phone: contact.phone,
    email: contact.email,
    isDecisionMaker: contact.isDecisionMaker,
    userId: contact.userId,
    createdAt: contact.createdAt,
  };
}

@Injectable()
export class AccountsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Create the account inside the convert transaction; the unique `lead_id` makes it one per lead. */
  async createAccount(data: AccountWriteData, client: Prisma.TransactionClient): Promise<string> {
    const account = await client.clientAccount.create({ data, select: { id: true } });
    return account.id;
  }

  async createContact(
    data: AccountContactWriteData,
    client: Prisma.TransactionClient,
  ): Promise<string> {
    const contact = await client.accountContact.create({ data, select: { id: true } });
    return contact.id;
  }

  /** The live account alone (no contacts), for a write's guards and its audit's before image. */
  async findAccount(id: string): Promise<AccountRow | null> {
    const account = await this.prisma.clientAccount.findFirst({
      where: { id, deletedAt: null },
      select: ACCOUNT_FIELDS,
    });
    return account ? toAccountRow(account) : null;
  }

  async updateAccount(
    id: string,
    patch: AccountPatch,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.clientAccount.update({ where: { id }, data: { ...patch, updatedBy: actorId } });
  }

  /** A live contact of a live account; null when either is missing or the contact is another account's. */
  async findContact(accountId: string, contactId: string): Promise<AccountContactRow | null> {
    const contact = await this.prisma.accountContact.findFirst({
      where: { id: contactId, accountId, deletedAt: null, account: { deletedAt: null } },
      select: CONTACT_FIELDS,
    });
    return contact ? toContactRow(contact) : null;
  }

  async updateContact(
    id: string,
    patch: AccountContactPatch,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.accountContact.update({ where: { id }, data: { ...patch, updatedBy: actorId } });
  }

  /** Soft delete (nothing is deleted outright, security.md "Personal data"). */
  async removeContact(
    id: string,
    actorId: string,
    client: Prisma.TransactionClient,
  ): Promise<void> {
    await client.accountContact.update({
      where: { id },
      data: { deletedAt: new Date(), updatedBy: actorId },
    });
  }

  async findById(id: string): Promise<AccountDetailRow | null> {
    const account = await this.prisma.clientAccount.findFirst({
      where: { id, deletedAt: null },
      select: {
        ...ACCOUNT_FIELDS,
        contacts: {
          where: { deletedAt: null },
          orderBy: { createdAt: "asc" },
          select: CONTACT_FIELDS,
        },
      },
    });
    if (!account) return null;
    return { ...toAccountRow(account), contacts: account.contacts.map(toContactRow) };
  }

  async list(
    filters: AccountListFilters,
    limit: number,
    cursor?: string,
  ): Promise<{ rows: AccountRow[]; nextCursor: string | null }> {
    const where: Prisma.ClientAccountWhereInput = { deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.q) {
      const q = filters.q;
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { coupleNames: { contains: q, mode: "insensitive" } },
      ];
    }
    const accounts = await this.prisma.clientAccount.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: ACCOUNT_FIELDS,
    });
    const hasMore = accounts.length > limit;
    const rows = (hasMore ? accounts.slice(0, limit) : accounts).map(toAccountRow);
    return { rows, nextCursor: hasMore ? rows[rows.length - 1]!.id : null };
  }
}
