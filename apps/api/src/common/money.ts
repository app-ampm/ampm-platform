import {
  clientAmount,
  internalAmount,
  type ClientAmount,
  type InternalAmount,
  type Money,
} from "@ampm/core";

import { Prisma } from "../generated/prisma/client.js";

/*
 * The one place a `numeric(14,2)` rupee column meets the wire's money shape (`{ minor, currency }`, in
 * whole paise). Two audiences, two brands (A-4, security.md): client-facing columns convert through
 * `toClientMoney` and internal ones (RESTRICTED-FINANCE) through `toInternalMoney`, so an internal
 * amount is built as an InternalAmount and can never satisfy a ClientAmount slot (MoneyText at the UI).
 * Decimal → number, scale, one round: no floating-point dust on the money path (data.md §1).
 */

const paise = (amount: Prisma.Decimal): number => Math.round(amount.toNumber() * 100);

/** A client-facing rupee column → CLIENT money in paise (Rs 25,000.00 → 2,500,000). */
export function toClientMoney(amount: Prisma.Decimal): ClientAmount {
  return clientAmount(paise(amount));
}

/** An internal rupee column → INTERNAL money in paise. Never reaches a client view. */
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
