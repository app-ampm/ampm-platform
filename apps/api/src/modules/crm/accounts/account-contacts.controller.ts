import { Controller, Delete, HttpCode, Patch, Post } from "@nestjs/common";
import {
  accountContactCreateRequest,
  accountContactUpdateRequest,
  uuid,
  type AccountContactCreateRequest,
  type AccountContactInviteLink,
  type AccountContactRemovedResponse,
  type AccountContactResult,
  type AccountContactUpdateRequest,
  type AccountContactView,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams } from "../../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { AccountContactsService } from "./account-contacts.service.js";
import { staffId } from "./accounts.controller.js";

const accountParams = z.object({ accountId: uuid });
const contactParams = z.object({ accountId: uuid, contactId: uuid });
type ContactParams = z.infer<typeof contactParams>;

/**
 * An account's contacts on the client hub (TW-13 Overview; the `crm.accounts.*` keys cover "client
 * accounts and contacts"). Add and invite mint a portal login, so they take `create` like Convert;
 * edit takes `update` and remove takes `delete` (SA/SM each). A test build also hands staff an invited
 * contact's activation link (`invite-link`, `create` like the invite it stands in for). Every write
 * self-audits in its service transaction.
 */
@Controller("crm")
export class AccountContactsController {
  constructor(private readonly contacts: AccountContactsService) {}

  @Post("accounts/:accountId/contacts")
  @RequirePermission("crm.accounts.create")
  @SelfAudited()
  @HttpCode(201)
  add(
    @ZodParams(accountParams) params: { accountId: string },
    @ZodBody(accountContactCreateRequest) body: AccountContactCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AccountContactResult> {
    return this.contacts.add(params.accountId, body, staffId(principal));
  }

  @Patch("accounts/:accountId/contacts/:contactId")
  @RequirePermission("crm.accounts.update")
  @SelfAudited()
  update(
    @ZodParams(contactParams) params: ContactParams,
    @ZodBody(accountContactUpdateRequest) body: AccountContactUpdateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AccountContactView> {
    return this.contacts.update(params.accountId, params.contactId, body, staffId(principal));
  }

  @Delete("accounts/:accountId/contacts/:contactId")
  @RequirePermission("crm.accounts.delete")
  @SelfAudited()
  remove(
    @ZodParams(contactParams) params: ContactParams,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AccountContactRemovedResponse> {
    return this.contacts.remove(params.accountId, params.contactId, staffId(principal));
  }

  @Post("accounts/:accountId/contacts/:contactId/invite")
  @RequirePermission("crm.accounts.create")
  @SelfAudited()
  @HttpCode(200)
  invite(
    @ZodParams(contactParams) params: ContactParams,
    @CurrentPrincipal() principal: Principal,
  ): Promise<AccountContactResult> {
    return this.contacts.invite(params.accountId, params.contactId, staffId(principal));
  }

  // Not under `/auth/dev-login*`: the test box keeps those paths behind its Basic-Auth, and a staff
  // Bearer there fails it (#147). Served on test builds only, a 404 elsewhere (the service's gate).
  @Post("accounts/:accountId/contacts/:contactId/invite-link")
  @RequirePermission("crm.accounts.create")
  @SelfAudited()
  @HttpCode(200)
  inviteLink(@ZodParams(contactParams) params: ContactParams): Promise<AccountContactInviteLink> {
    return this.contacts.inviteLink(params.accountId, params.contactId);
  }
}
