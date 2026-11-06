import type { Money } from "@ampm/core";

import { Prisma } from "../../generated/prisma/client.js";

/*
 * The wire money shape (`{ minor, currency }`, paise) vs the Prisma Decimal(14,2) column (rupees). Rate
 * amounts cross this boundary on every read and write; keep the conversion in one place so paise never
 * leak into the column or rupees onto the wire.
 */

/** A Decimal(14,2) rupee amount to the wire money shape (minor units / paise). */
export function decimalToMoney(value: Prisma.Decimal): Money {
  return { minor: Math.round(value.toNumber() * 100), currency: "INR" };
}

/** A wire money amount to the string Prisma.Decimal accepts, exact to the paisa (e.g. 180000 -> "1800.00"). */
export function moneyToDecimalString(value: Money): string {
  return (value.minor / 100).toFixed(2);
}
