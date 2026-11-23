import { Injectable } from "@nestjs/common";
import {
  coupleTitle,
  errors,
  type AccountDetailView,
  type AccountListQuery,
  type AccountPage,
  type AccountUpdateRequest,
  type LeadConvertRequest,
  type LeadConvertResponse,
  type LeadStatus,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuditService } from "../../../policy/audit.service.js";
import { LeadsRepository } from "../leads/leads.repository.js";
import { DEFAULT_CONTACT_RELATION } from "./account-constants.js";
import { AccountInviteService, type Invitee, type MintedInvite } from "./account-invite.service.js";
import { accountPatchOf, beforeImage, withCoupleNaming } from "./account-patches.js";
import {
  AccountsRepository,
  type AccountContactWriteData,
  type AccountWriteData,
} from "./accounts.repository.js";
import { toAccountContactView, toAccountDetailView, toAccountView } from "./accounts.view.js";

/** The couple a convert names, each a name or null (an empty box is no name). */
interface ConvertCouple {
  readonly brideName: string | null;
  readonly brideFatherName: string | null;
  readonly groomName: string | null;
  readonly groomFatherName: string | null;
}

interface ConvertPlan extends ConvertCouple {
  readonly leadId: string;
  readonly previousStatus: LeadStatus;
  readonly accountName: string;
  readonly coupleNames: string | null;
  readonly preferredLocations: string | null;
  readonly contact: {
    readonly name: string;
    readonly relation: string;
    readonly email: string;
    readonly phone: string | null;
    readonly isDecisionMaker: boolean;
  };
  readonly actorId: string;
}

/**
 * Client accounts (Module B CRM, feature 8.2). Convert (TW-11, AC-01.8) turns a lead into a
 * `client_accounts` row with its primary contact and a portal invite, leaving the lead read-only. The
 * `users` row + invite are minted through the kernel identity services (never by writing `users` here —
 * api.md), and the whole conversion is one transaction so an account never exists without its invite.
 * The hub (TW-13) edits the account's details here and its contacts in AccountContactsService; status
 * changes (suspend refuses sign-in) and Finance billing are later increments.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly leads: LeadsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invites: AccountInviteService,
  ) {}

  async convert(
    leadId: string,
    request: LeadConvertRequest,
    actorId: string,
  ): Promise<LeadConvertResponse> {
    const lead = await this.leads.findById(leadId);
    if (!lead) throw errors.notFound("No such lead");
    if (lead.status === "converted") throw errors.conflict("This lead has already been converted");
    if (lead.status === "closed") throw errors.conflict("A closed lead cannot be converted");

    const plan = buildConvertPlan(leadId, lead, request, actorId);
    const created = await this.runConvert(plan);
    // Provision the sign-in account and deliver the invite after commit, best-effort (AccountInviteService).
    const inviteQueued = await this.invites.send(inviteeOf(plan), created);

    const detail = await this.accounts.findById(created.accountId);
    if (!detail) throw errors.notFound("No such account");
    const primaryContact =
      detail.contacts.find((contact) => contact.userId === created.userId) ?? detail.contacts[0];
    if (!primaryContact) throw new Error("the converted account has no primary contact");
    return {
      account: toAccountView(detail),
      primaryContact: toAccountContactView(primaryContact),
      inviteQueued,
    };
  }

  private async runConvert(plan: ConvertPlan): Promise<MintedInvite & { accountId: string }> {
    try {
      return await this.prisma.$transaction((tx) => this.convertInTransaction(plan, tx));
    } catch (error) {
      // The unique `client_accounts.lead_id` trips when the same lead is converted concurrently; the
      // status guard catches the sequential case, this catches the race. (A duplicate contact email is
      // already a 409 thrown by provisionInvitedClient, so it is not a PrismaClientKnownRequestError.)
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw errors.conflict("This lead has already been converted");
      }
      throw error;
    }
  }

  private async convertInTransaction(
    plan: ConvertPlan,
    tx: Prisma.TransactionClient,
  ): Promise<MintedInvite & { accountId: string }> {
    const { userId, inviteToken } = await this.invites.mint(inviteeOf(plan), tx);
    const accountId = await this.accounts.createAccount(toAccountData(plan, userId), tx);
    await this.accounts.createContact(toContactData(plan, accountId, userId), tx);
    await this.leads.markConverted(plan.leadId, accountId, plan.actorId, tx);
    await this.recordConversionAudit(tx, plan, accountId, userId);
    return { accountId, userId, inviteToken };
  }

  private async recordConversionAudit(
    tx: Prisma.TransactionClient,
    plan: ConvertPlan,
    accountId: string,
    userId: string,
  ): Promise<void> {
    await this.audit.record(
      {
        action: "create",
        entityType: "client_account",
        entityId: accountId,
        after: { leadId: plan.leadId, status: "prospect", primaryContactUserId: userId },
      },
      tx,
    );
    await this.audit.record(
      {
        action: "update",
        entityType: "lead",
        entityId: plan.leadId,
        before: { status: plan.previousStatus },
        after: { status: "converted", convertedAccountId: accountId },
      },
      tx,
    );
  }

  /**
   * Edit the account's details from the hub (TW-13): name, the couple (bride and groom with their
   * fathers), preferred locations and the internal notes. Once the bride and groom are both named the
   * account takes the couple's name (withCoupleNaming). One transaction with its audit, which holds
   * exactly the changed fields.
   */
  async update(
    accountId: string,
    request: AccountUpdateRequest,
    actorId: string,
  ): Promise<AccountDetailView> {
    const current = await this.accounts.findAccount(accountId);
    if (!current) throw errors.notFound("No such account");
    const patch = withCoupleNaming(current, accountPatchOf(request));
    await this.prisma.$transaction(async (tx) => {
      await this.accounts.updateAccount(accountId, patch, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "client_account",
          entityId: accountId,
          before: beforeImage(current, patch),
          after: patch,
        },
        tx,
      );
    });
    return this.get(accountId);
  }

  async get(accountId: string): Promise<AccountDetailView> {
    const detail = await this.accounts.findById(accountId);
    if (!detail) throw errors.notFound("No such account");
    return toAccountDetailView(detail);
  }

  async list(query: AccountListQuery): Promise<AccountPage> {
    const { rows, nextCursor } = await this.accounts.list(
      { status: query.status, q: query.q },
      query.limit,
      query.cursor,
    );
    return { items: rows.map(toAccountView), nextCursor };
  }
}

function inviteeOf(plan: ConvertPlan): Invitee {
  const { name, email, phone } = plan.contact;
  return { name, email, phone, actorId: plan.actorId };
}

function toAccountData(plan: ConvertPlan, userId: string): AccountWriteData {
  return {
    name: plan.accountName,
    coupleNames: plan.coupleNames,
    brideName: plan.brideName,
    brideFatherName: plan.brideFatherName,
    groomName: plan.groomName,
    groomFatherName: plan.groomFatherName,
    preferredLocations: plan.preferredLocations,
    status: "prospect",
    isDemo: false,
    primaryContactUserId: userId,
    leadId: plan.leadId,
    createdBy: plan.actorId,
  };
}

function toContactData(
  plan: ConvertPlan,
  accountId: string,
  userId: string,
): AccountContactWriteData {
  return {
    accountId,
    name: plan.contact.name,
    relation: plan.contact.relation,
    email: plan.contact.email,
    phone: plan.contact.phone,
    isDecisionMaker: plan.contact.isDecisionMaker,
    userId,
    createdBy: plan.actorId,
  };
}

function convertCoupleOf(request: LeadConvertRequest): ConvertCouple {
  return {
    brideName: request.brideName || null,
    brideFatherName: request.brideFatherName || null,
    groomName: request.groomName || null,
    groomFatherName: request.groomFatherName || null,
  };
}

/**
 * Build the convert plan: every field defaults from the lead, so the request may carry only the email.
 * A bride and groom given together name the account after the couple (D-158).
 */
function buildConvertPlan(
  leadId: string,
  lead: NonNullable<Awaited<ReturnType<LeadsRepository["findById"]>>>,
  request: LeadConvertRequest,
  actorId: string,
): ConvertPlan {
  const couple = convertCoupleOf(request);
  const title = coupleTitle(couple);
  return {
    leadId,
    previousStatus: lead.status,
    accountName: title ?? request.accountName ?? lead.name,
    coupleNames: title ?? request.coupleNames ?? null,
    ...couple,
    preferredLocations: request.preferredLocations ?? null,
    contact: {
      name: request.primaryContact.name ?? lead.name,
      relation: request.primaryContact.relation ?? DEFAULT_CONTACT_RELATION,
      email: request.primaryContact.email,
      phone: request.primaryContact.phone ?? lead.phone ?? null,
      isDecisionMaker: request.primaryContact.isDecisionMaker,
    },
    actorId,
  };
}
