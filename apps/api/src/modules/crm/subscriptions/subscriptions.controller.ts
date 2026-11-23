import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  manualPaymentRequest,
  subscriptionCreateRequest,
  subscriptionListQuery,
  uuid,
  type ManualPaymentRequest,
  type SubscriptionCreateRequest,
  type SubscriptionCreateResponse,
  type SubscriptionListQuery,
  type SubscriptionPage,
  type SubscriptionView,
} from "@ampm/core";
import { RECORD_SUBSCRIPTION_PAYMENT } from "@ampm/policy";
import { z } from "zod";

import { ZodBody, ZodParams, ZodQuery } from "../../../common/zod.js";
import {
  Audited,
  CurrentPrincipal,
  RequirePermission,
  SelfAudited,
} from "../../../policy/decorators.js";
import { type Principal, staffId } from "../../../policy/principal.types.js";
import { SubscriptionsService } from "./subscriptions.service.js";

/**
 * Subscriptions (Module B CRM, feature 8.3). The purchase and the Finance manual bank transfer are
 * staff-initiated (the client self-purchase screen CP-11 defers): create starts a `pending_payment`
 * subscription and a gateway order; record-payment runs the activation step Finance uses for an
 * off-gateway payment (TW-14). Reads are the Sales/Finance workspace surface. The gateway webhook has
 * its own public, signature-verified controller.
 */
@Controller("crm")
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Post("subscriptions")
  @RequirePermission("crm.subscriptions.create")
  @Audited({ entityType: "subscription", entityIdPath: "subscriptionId" })
  @HttpCode(201)
  create(
    @ZodBody(subscriptionCreateRequest) body: SubscriptionCreateRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SubscriptionCreateResponse> {
    return this.subscriptions.create(body, staffId(principal));
  }

  @Post("subscriptions/:subscriptionId/record-payment")
  // Recording changes the subscription's status alone, which Finance may update too (D-125).
  @RequirePermission(RECORD_SUBSCRIPTION_PAYMENT.key, {
    fields: RECORD_SUBSCRIPTION_PAYMENT.fields,
  })
  @SelfAudited()
  @HttpCode(200)
  recordPayment(
    @ZodParams(z.object({ subscriptionId: uuid })) params: { subscriptionId: string },
    @ZodBody(manualPaymentRequest) body: ManualPaymentRequest,
    @CurrentPrincipal() principal: Principal,
  ): Promise<SubscriptionView> {
    return this.subscriptions.recordManualPayment(params.subscriptionId, body, staffId(principal));
  }

  @Get("subscriptions")
  @RequirePermission("crm.subscriptions.read")
  list(@ZodQuery(subscriptionListQuery) query: SubscriptionListQuery): Promise<SubscriptionPage> {
    return this.subscriptions.list(query);
  }

  @Get("subscriptions/:subscriptionId")
  @RequirePermission("crm.subscriptions.read")
  get(
    @ZodParams(z.object({ subscriptionId: uuid })) params: { subscriptionId: string },
  ): Promise<SubscriptionView> {
    return this.subscriptions.get(params.subscriptionId);
  }
}
