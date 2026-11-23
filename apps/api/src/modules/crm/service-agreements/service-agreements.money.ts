import type { Money } from "@ampm/core";

import { Prisma } from "../../../generated/prisma/client.js";

/**
 * The service-agreement fee is CLIENT-facing (the amount the account agreed to pay). Reading it goes
 * through `toClientMoney` (common/money.ts); writing it converts here, with Decimal arithmetic, so no
 * floating-point dust reaches the column (data.md §1).
 */

/** Client money in paise (the entered fee) → the `numeric(14,2)` rupee value the column stores. */
export function moneyToDecimal(money: Money): Prisma.Decimal {
  return new Prisma.Decimal(money.minor).div(100);
}
