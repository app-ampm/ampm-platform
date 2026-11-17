import { Injectable } from "@nestjs/common";
import {
  errors,
  type AccountContactCreateRequest,
  type AccountContactInviteLink,
  type AccountContactRemovedResponse,
  type AccountContactResult,
  type AccountContactUpdateRequest,
  type AccountContactView,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { AuditService } from "../../../policy/audit.service.js";
import { AccountInviteService, type Invitee } from "./account-invite.service.js";
import { beforeImage, contactPatchOf } from "./account-patches.js";
import {
  AccountsRepository,
  type AccountContactRow,
  type AccountRow,
} from "./accounts.repository.js";
import { toAccountContactView } from "./accounts.view.js";

/** Accounts whose contacts may be invited: a demo account is reset nightly and a suspended or closed
 *  one refuses sign-in, so an invite there would mint a login that can never be used. */
const INVITABLE_STATUSES: ReadonlySet<AccountRow["status"]> = new Set(["prospect", "active"]);

/**
 * An account's contacts from the client hub (TW-13 Overview): add, edit, remove, and invite to the
 * portal. A contact with a portal login keeps the email it signs in with (the login's email lives on
 * `users`; changing it is an identity flow) and cannot be removed here. Every write is one transaction
 * with its audit; an invite's sign-in account and email go out after commit (AccountInviteService).
 */
@Injectable()
export class AccountContactsService {
  constructor(
    private readonly accounts: AccountsRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly invites: AccountInviteService,
  ) {}

  async add(
    accountId: string,
    request: AccountContactCreateRequest,
    actorId: string,
  ): Promise<AccountContactResult> {
    const account = await this.requireAccount(accountId);
    const invitee = request.invite ? inviteeFor(request, actorId) : null;
    if (invitee) assertInvitable(account);
    const { contactId, minted } = await this.prisma.$transaction(async (tx) => {
      const login = invitee ? await this.invites.mint(invitee, tx) : null;
      const data = {
        accountId,
        name: request.name,
        relation: request.relation,
        email: request.email ?? null,
        phone: request.phone ?? null,
        isDecisionMaker: request.isDecisionMaker,
        userId: login?.userId ?? null,
      };
      const id = await this.accounts.createContact({ ...data, createdBy: actorId }, tx);
      await this.audit.record(
        { action: "create", entityType: "account_contact", entityId: id, after: data },
        tx,
      );
      return { contactId: id, minted: login };
    });
    const inviteQueued = invitee && minted ? await this.invites.send(invitee, minted) : false;
    return { contact: await this.view(accountId, contactId), inviteQueued };
  }

  async update(
    accountId: string,
    contactId: string,
    request: AccountContactUpdateRequest,
    actorId: string,
  ): Promise<AccountContactView> {
    const current = await this.requireContact(accountId, contactId);
    if (current.userId && request.email !== undefined && request.email !== current.email) {
      throw errors.validation([
        { path: "email", message: "This contact signs in with this email, so it stays as it is" },
      ]);
    }
    const patch = contactPatchOf(request);
    await this.prisma.$transaction(async (tx) => {
      await this.accounts.updateContact(contactId, patch, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "account_contact",
          entityId: contactId,
          before: beforeImage(current, patch),
          after: patch,
        },
        tx,
      );
    });
    return this.view(accountId, contactId);
  }

  async remove(
    accountId: string,
    contactId: string,
    actorId: string,
  ): Promise<AccountContactRemovedResponse> {
    const current = await this.requireContact(accountId, contactId);
    if (current.userId) {
      throw errors.conflict("This contact has a portal login, so it cannot be removed here");
    }
    await this.prisma.$transaction(async (tx) => {
      await this.accounts.removeContact(contactId, actorId, tx);
      await this.audit.record(
        {
          action: "delete",
          entityType: "account_contact",
          entityId: contactId,
          before: { accountId, name: current.name, relation: current.relation },
        },
        tx,
      );
    });
    return { id: contactId };
  }

  /** Give an existing contact a portal login and send the invite (TW-13 "Invite portal user"). */
  async invite(
    accountId: string,
    contactId: string,
    actorId: string,
  ): Promise<AccountContactResult> {
    assertInvitable(await this.requireAccount(accountId));
    const contact = await this.requireContact(accountId, contactId);
    if (contact.userId) throw errors.conflict("This contact already has a portal login");
    if (!contact.email) {
      throw errors.validation([
        { path: "email", message: "Add an email to send the portal invite to" },
      ]);
    }
    const invitee: Invitee = {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      actorId,
    };
    const minted = await this.prisma.$transaction(async (tx) => {
      const login = await this.invites.mint(invitee, tx);
      await this.accounts.updateContact(contactId, { userId: login.userId }, actorId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "account_contact",
          entityId: contactId,
          before: { userId: null },
          after: { userId: login.userId },
        },
        tx,
      );
      return login;
    });
    const inviteQueued = await this.invites.send(invitee, minted);
    return { contact: await this.view(accountId, contactId), inviteQueued };
  }

  /**
   * Test builds only (a 404 elsewhere): a fresh activation link for a contact whose login is still
   * `invited`, so staff can hand it over where no email is delivered. Retires the earlier links; audited.
   */
  async inviteLink(accountId: string, contactId: string): Promise<AccountContactInviteLink> {
    this.invites.assertLinksServed();
    assertInvitable(await this.requireAccount(accountId));
    const { userId } = await this.requireContact(accountId, contactId);
    if (!userId) throw errors.conflict("Send the portal invite first: this contact has no login");
    const activationUrl = await this.prisma.$transaction(async (tx) => {
      const url = await this.invites.reissueLink(userId, tx);
      await this.audit.record(
        {
          action: "update",
          entityType: "account_contact",
          entityId: contactId,
          after: { inviteLinkIssued: true },
        },
        tx,
      );
      return url;
    });
    return { activationUrl };
  }

  private async requireAccount(accountId: string): Promise<AccountRow> {
    const account = await this.accounts.findAccount(accountId);
    if (!account) throw errors.notFound("No such account");
    return account;
  }

  private async requireContact(accountId: string, contactId: string): Promise<AccountContactRow> {
    const contact = await this.accounts.findContact(accountId, contactId);
    if (!contact) throw errors.notFound("No such contact");
    return contact;
  }

  private async view(accountId: string, contactId: string): Promise<AccountContactView> {
    return toAccountContactView(await this.requireContact(accountId, contactId));
  }
}

function assertInvitable(account: AccountRow): void {
  if (account.isDemo) throw errors.conflict("A demo account cannot invite portal users");
  if (!INVITABLE_STATUSES.has(account.status)) {
    throw errors.conflict("A suspended or closed account cannot invite portal users");
  }
}

/** The invitee an add asks for; the request schema already refuses an invite without an email. */
function inviteeFor(request: AccountContactCreateRequest, actorId: string): Invitee | null {
  if (!request.email) return null;
  return { name: request.name, email: request.email, phone: request.phone ?? null, actorId };
}
