import { Inject, Injectable } from "@nestjs/common";
import {
  errors,
  type AccountDetailView,
  type AccountListQuery,
  type AccountPage,
  type LeadConvertRequest,
  type LeadConvertResponse,
  type LeadStatus,
} from "@ampm/core";

import { AppLogger } from "../../../common/logger.service.js";
import { PrismaService } from "../../../db/prisma.service.js";
import { ENV, type Env } from "../../../env.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { AuthTokenService } from "../../../identity/auth-token.service.js";
import { ClientUserService } from "../../../identity/client-user.service.js";
import {
  IDENTITY_PROVISIONER,
  type IdentityProvisioner,
} from "../../../identity/identity.types.js";
import { AuditService } from "../../../policy/audit.service.js";
import { NotificationService } from "../../admin/notification/notification.service.js";
import { LeadsRepository } from "../leads/leads.repository.js";
import { DEFAULT_CONTACT_RELATION } from "./account-constants.js";
import {
  AccountsRepository,
  type AccountContactWriteData,
  type AccountWriteData,
} from "./accounts.repository.js";
import { toAccountContactView, toAccountDetailView, toAccountView } from "./accounts.view.js";

interface ConvertPlan {
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
 * Account update/delete and Finance billing are later increments.
 */
@Injectable()
export class AccountsService {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly leads: LeadsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authTokens: AuthTokenService,
    private readonly clientUsers: ClientUserService,
    private readonly notifications: NotificationService,
    private readonly logger: AppLogger,
    @Inject(IDENTITY_PROVISIONER) private readonly provisioner: IdentityProvisioner,
    @Inject(ENV) private readonly env: Env,
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
    // Provision the Cognito sign-in account (cognito-setup §6) before the invite is queued. Best-effort
    // after the conversion commits and outside its transaction (an AWS call must not hold a DB tx open),
    // and a no-op under IDENTITY_PROVIDER=local; a failure is logged, not fatal — the account and its
    // invite already exist and the client-login reinvite path re-provisions idempotently.
    await this.provisioner
      .provisionUser({ kind: "client", email: plan.contact.email, phone: plan.contact.phone })
      .catch((error: unknown) =>
        this.logger.warn("account.convert.provision_failed", {
          userId: created.userId,
          error: String(error),
        }),
      );
    const inviteQueued = await this.queueInvite(
      created.userId,
      plan.contact.name,
      created.inviteToken,
    );

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

  private async runConvert(
    plan: ConvertPlan,
  ): Promise<{ accountId: string; userId: string; inviteToken: string }> {
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
  ): Promise<{ accountId: string; userId: string; inviteToken: string }> {
    const { userId } = await this.clientUsers.provisionInvitedClient(
      {
        name: plan.contact.name,
        email: plan.contact.email,
        phone: plan.contact.phone,
        createdBy: plan.actorId,
      },
      tx,
    );
    const accountId = await this.accounts.createAccount(toAccountData(plan, userId), tx);
    await this.accounts.createContact(toContactData(plan, accountId, userId), tx);
    await this.leads.markConverted(plan.leadId, accountId, plan.actorId, tx);
    const inviteToken = await this.authTokens.issueInvite(userId, tx);
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

  /** Deliver the portal invite after commit; best-effort, so a transient failure does not fail the
   *  conversion (the invite token is saved and can be re-sent). `false` means it was not delivered. */
  private async queueInvite(userId: string, name: string, inviteToken: string): Promise<boolean> {
    try {
      const result = await this.notifications.queue({
        recipientType: "user",
        recipientId: userId,
        channel: "email",
        eventType: "client.invited",
        templateKey: "client.invite",
        entityType: "user",
        entityId: userId,
        variables: {
          name,
          activationUrl: `${this.env.WEB_APP_URL}/activate?token=${encodeURIComponent(inviteToken)}`,
        },
      });
      return result.suppressed === false;
    } catch {
      return false;
    }
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

function toAccountData(plan: ConvertPlan, userId: string): AccountWriteData {
  return {
    name: plan.accountName,
    coupleNames: plan.coupleNames,
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

/** Build the convert plan: every field defaults from the lead, so the request may carry only the email. */
function buildConvertPlan(
  leadId: string,
  lead: NonNullable<Awaited<ReturnType<LeadsRepository["findById"]>>>,
  request: LeadConvertRequest,
  actorId: string,
): ConvertPlan {
  return {
    leadId,
    previousStatus: lead.status,
    accountName: request.accountName ?? lead.name,
    coupleNames: request.coupleNames ?? null,
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
