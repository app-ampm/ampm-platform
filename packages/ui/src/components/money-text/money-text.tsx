import { formatAmount, type ClientAmount } from "@ampm/core";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Text, type TextProps } from "../text";

export interface MoneyTextProps extends Omit<TextProps, "children"> {
  /** A client-facing amount only; the type keeps internal costs and margins out (data-model A-4). */
  readonly amount: ClientAmount;
  /**
   * The top of an indicative range (the API's `amountMax`), client-facing like `amount`: renders
   * `₹16,000–24,000`, one rupee sign and an en dash. Null, or equal to `amount`, shows one value.
   */
  readonly amountMax?: ClientAmount | null | undefined;
}

const EN_DASH = "–";

/** "₹24,000" → "24,000": a range prints the rupee sign once, on its lower bound. */
function withoutCurrencySign(formatted: string): string {
  return formatted.replace(/[^\d.,-]/g, "");
}

/**
 * A client amount or range as shown (`₹16,000–24,000`) and as spoken (`₹16,000 to ₹24,000`), for
 * places that need the string, such as a ListItem's `meta`. Client amounts only, like MoneyText.
 *
 *   formatMoney(clientAmount(1600000), clientAmount(2400000)).text  // "₹16,000–24,000"
 */
export function formatMoney(
  amount: ClientAmount,
  amountMax?: ClientAmount | null,
): { readonly text: string; readonly label: string } {
  const low = formatAmount(amount);
  if (!amountMax || amountMax.minor === amount.minor) return { text: low, label: low };
  const high = formatAmount(amountMax);
  return {
    text: `${low}${EN_DASH}${withoutCurrencySign(high)}`,
    label: uiCopy.moneyText.range(low, high),
  };
}

/**
 * A client-facing amount in Manrope 600 with tabular figures and Indian grouping (`₹46,80,000`), or
 * an indicative range (`₹16,000–24,000`). Values are pearl 100%; the `data` variant (13) by default,
 * any Text variant for bigger figures. A figure is read as text, never as a heading, whatever its
 * size (the title and display variants would otherwise be headers, an <h1> on the web). It never
 * receives an internal amount: cost, margin and vendor prices stay on staff screens, inside
 * InternalPanel (.claude/rules/security.md).
 *
 *   <MoneyText amount={clientAmount(468000000)} />
 *   <MoneyText amount={clientAmount(1600000)} amountMax={clientAmount(2400000)} />
 *   <MoneyText amount={clientAmount(5000000)} variant="title" />
 */
export function MoneyText({
  amount,
  amountMax,
  variant = "data",
  weight = "semibold",
  tone = "primary",
  className,
  ...rest
}: MoneyTextProps) {
  const { text, label } = formatMoney(amount, amountMax);
  return (
    <Text
      variant={variant}
      weight={weight}
      tone={tone}
      accessibilityRole="text"
      accessibilityLabel={label}
      className={cn("tabular-nums", className)}
      {...rest}
    >
      {text}
    </Text>
  );
}
