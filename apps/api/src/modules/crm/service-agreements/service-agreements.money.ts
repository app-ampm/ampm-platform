import { clientAmount, type Money } from "@ampm/core";

import { Prisma } from "../../../generated/prisma/client.js";

/**
 * The service-agreement fee is CLIENT-facing (the amount the account agreed to pay), so it crosses the
 * wire as client money in integer minor units (paise), the shape money.ts and subscriptions/money.ts
 * use. Decimal arithmetic both ways — no floating-point dust on the money path (data.md §1).
 */

/** A `numeric(14,2)` rupee fee (the DB column) → client money in paise (Rs 25,000.00 → 2,500,000). */
export function toClientMoney(amount: Prisma.Decimal): Money {
  return clientAmount(Math.round(amount.toNumber() * 100));
}

/** Client money in paise (the entered fee) → the `numeric(14,2)` rupee value the column stores. */
export function moneyToDecimal(money: Money): Prisma.Decimal {
  return new Prisma.Decimal(money.minor).div(100);
}
