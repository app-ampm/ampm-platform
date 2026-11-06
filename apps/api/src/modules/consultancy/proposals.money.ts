import {
  clientAmount,
  internalAmount,
  type ClientAmount,
  type InternalAmount,
  type Money,
} from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";

/**
 * Two money columns, two audiences (A-4, security.md). `client_total_amount` is CLIENT money;
 * `internal_total_amount` is RESTRICTED-FINANCE. Each numeric(14,2) rupee column converts through its
 * OWN branded helper, so an internal amount is built as an InternalAmount and can never satisfy a
 * ClientAmount slot (e.g. MoneyText at the UI). Decimal → number, scale, one round: no float dust on the
 * money path (data.md §1). The derived margin is computed in integer paise so the subtraction is exact.
 */

const paise = (amount: Prisma.Decimal): number => Math.round(amount.toNumber() * 100);

/** client_total_amount / a client-visible line amount → CLIENT money (paise). */
export function toClientMoney(amount: Prisma.Decimal): ClientAmount {
  return clientAmount(paise(amount));
}

/** internal_total_amount → INTERNAL money (paise). Never reaches a client view. */
export function toInternalMoney(amount: Prisma.Decimal): InternalAmount {
  return internalAmount(paise(amount));
}

/** DERIVED margin (never a column; brief §10.4): client_total − internal_total, in exact integer paise.
 * INTERNAL money (RESTRICTED-FINANCE); may be negative (a loss where the hotel net exceeds the price). */
export function deriveMargin(
  clientTotal: Prisma.Decimal,
  internalTotal: Prisma.Decimal,
): InternalAmount {
  return internalAmount(paise(clientTotal) - paise(internalTotal));
}

/** Wire money (paise) → the string a Prisma.Decimal column accepts, exact to the paisa (2_500_000 → "25000.00"). */
export function moneyToDecimalString(money: Money): string {
  return (money.minor / 100).toFixed(2);
}
