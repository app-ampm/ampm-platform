/**
 * Money with its audience in the type. A client-facing amount and an internal amount (cost, margin,
 * vendor price) can never be mixed up by accident: `MoneyText` and every client serialiser accept
 * `ClientAmount` only, and nothing turns an `InternalAmount` into one except an explicit decision in
 * the pricing module (data-model §0, A-4). Amounts are integers in the currency's minor unit (paise).
 */
const audience: unique symbol = Symbol("audience");

export type Currency = "INR";

interface Amount<A extends "client" | "internal"> {
  readonly [audience]: A;
  readonly minor: number;
  readonly currency: Currency;
}

/** An amount the client may see. */
export type ClientAmount = Amount<"client">;
/** An amount that stays inside AMPM. */
export type InternalAmount = Amount<"internal">;

function amount<A extends "client" | "internal">(
  kind: A,
  minor: number,
  currency: Currency,
): Amount<A> {
  if (!Number.isInteger(minor))
    throw new RangeError(`money: ${minor} is not a whole number of minor units`);
  return { [audience]: kind, minor, currency } as Amount<A>;
}

export function clientAmount(minor: number, currency: Currency = "INR"): ClientAmount {
  return amount("client", minor, currency);
}

export function internalAmount(minor: number, currency: Currency = "INR"): InternalAmount {
  return amount("internal", minor, currency);
}

/** Indian grouping and the rupee sign: ₹12,34,567 or ₹1,234.50; paise shown only when present. */
export function formatAmount(value: ClientAmount | InternalAmount, locale = "en-IN"): string {
  const whole = value.minor % 100 === 0;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value.minor / 100);
}
