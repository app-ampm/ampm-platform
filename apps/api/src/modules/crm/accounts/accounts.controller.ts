import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  accountListQuery,
  leadConvertRequest,
  uuid,
  type AccountDetailView,
  type AccountListQuery,
  type AccountPage,
  type LeadConvertRequest,
  type LeadConvertResponse,
} from "@ampm/core";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import { CurrentPrincipal, RequirePermission, SelfAudited } from "../../../policy/decorators.js";
import type { Principal } from "../../../policy/principal.types.js";
import { AccountsService } from "./accounts.service.js";

function staffId(principal: Principal): string {
  if (principal.type !== "staff") throw new Error("a staff principal is required");
  return principal.userId;
}

/**
 * Client accounts (Module B CRM, feature 8.2). Convert creates an account from a lead and is a
 * system-set lead transition, so it is guarded by `crm.accounts.create` (SA/SM) and writes its own
 * precise audit (`@SelfAudited`). The reads are the Sales workspace account surface (TW-11); account
 * update/delete land with the account-management increment.
 */
@Controller("crm")
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Post("leads/:leadId/convert")
  @RequirePermission("crm.accounts.create")
  @SelfAudited()
  @HttpCode(201)
  convert(
    @ZodParams(z.object({ leadId: uuid })) params: { leadId: string },
    @ZodBody(leadConvertRequest) body: LeadConvertRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<LeadConvertResponse> {
    return this.accounts.convert(params.leadId, body, staffId(principal));
  }

  @Get("accounts")
  @RequirePermission("crm.accounts.read")
  list(@ZodQuery(accountListQuery) query: AccountListQuery): Promise<AccountPage> {
    return this.accounts.list(query);
  }

  @Get("accounts/:accountId")
  @RequirePermission("crm.accounts.read")
  get(
    @ZodParams(z.object({ accountId: uuid })) params: { accountId: string },
  ): Promise<AccountDetailView> {
    return this.accounts.get(params.accountId);
  }
}
