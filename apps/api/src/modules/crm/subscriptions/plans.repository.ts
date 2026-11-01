import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../../db/prisma.service.js";
import type {
  BillingType,
  PlanModuleAccess,
  PlanType,
  Prisma,
} from "../../../generated/prisma/client.js";

/** A plan's module grant as stored; `moduleKey` is an @ampm/core entitlement module (validated in the view). */
export interface PlanModuleRow {
  readonly moduleKey: string;
  readonly accessLevel: PlanModuleAccess;
}

/** A plan as read for the public catalogue and for a purchase (price and term drive the order). */
export interface PlanRow {
  readonly id: string;
  readonly planKey: string;
  readonly name: string;
  readonly planType: PlanType;
  readonly billingType: BillingType;
  readonly priceAmount: Prisma.Decimal;
  readonly currency: string;
  readonly termDays: number | null;
  readonly trialDays: number | null;
  readonly modules: PlanModuleRow[];
}

const PLAN_SELECT = {
  id: true,
  planKey: true,
  name: true,
  planType: true,
  billingType: true,
  priceAmount: true,
  currency: true,
  termDays: true,
  trialDays: true,
  modules: {
    where: { deletedAt: null },
    orderBy: { moduleKey: "asc" },
    select: { moduleKey: true, accessLevel: true },
  },
} as const;

type SelectedPlan = Prisma.PlanGetPayload<{ select: typeof PLAN_SELECT }>;

function toPlanRow(plan: SelectedPlan): PlanRow {
  return {
    id: plan.id,
    planKey: plan.planKey,
    name: plan.name,
    planType: plan.planType,
    billingType: plan.billingType,
    priceAmount: plan.priceAmount,
    currency: plan.currency,
    termDays: plan.termDays,
    trialDays: plan.trialDays,
    modules: plan.modules.map((module) => ({
      moduleKey: module.moduleKey,
      accessLevel: module.accessLevel,
    })),
  };
}

@Injectable()
export class PlansRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The public catalogue: active plans only (PUBLIC), with their modules. */
  async listActive(): Promise<PlanRow[]> {
    const plans = await this.prisma.plan.findMany({
      where: { status: "active", deletedAt: null },
      orderBy: { priceAmount: "asc" },
      select: PLAN_SELECT,
    });
    return plans.map(toPlanRow);
  }

  /** A single active plan by id — the only plans a subscription may be bought against. */
  async findActiveById(id: string): Promise<PlanRow | null> {
    const plan = await this.prisma.plan.findFirst({
      where: { id, status: "active", deletedAt: null },
      select: PLAN_SELECT,
    });
    return plan ? toPlanRow(plan) : null;
  }

  /** The plan's term length, to compute a subscription's end date inside the activation transaction. */
  async termDaysById(planId: string, client: Prisma.TransactionClient): Promise<number | null> {
    const plan = await client.plan.findUnique({
      where: { id: planId },
      select: { termDays: true },
    });
    return plan?.termDays ?? null;
  }
}
