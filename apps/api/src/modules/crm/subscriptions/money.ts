import { clientAmount, type Money } from "@ampm/core";

import type { Prisma } from "../../../generated/prisma/client.js";

/**
 * Convert a `numeric(14,2)` rupee amount (the DB money type, data.md) to a client money value in
 * integer minor units (paise), the shape money.ts and the wire use. Decimal arithmetic, then a round,
 * so no floating-point dust reaches the amount (Rs 50,000.00 → 5,000,000 paise). Feature 8.3 is the
 * first money serialisation in the codebase (D-record).
 */
export function toClientMoney(amount: Prisma.Decimal): Money {
  return clientAmount(Math.round(amount.toNumber() * 100));
}
