import { clientAmount, type ClientAmount, type Money } from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";

/**
 * Money mapping for booking milestones (feature 10.5). One `amount` column (CLIENT, A-4), so the single
 * helper returns a branded `ClientAmount`; the client serialiser then gates it behind the W-14 config
 * flag. `Prisma.Decimal` numeric(14,2) ⇄ the wire `{ minor, currency }` money shape, in whole paise.
 */

const paise = (amount: Prisma.Decimal): number => Math.round(amount.toNumber() * 100);

export function toClientMoney(amount: Prisma.Decimal): ClientAmount {
  return clientAmount(paise(amount));
}

export function moneyToDecimalString(money: Money): string {
  return (money.minor / 100).toFixed(2);
}
