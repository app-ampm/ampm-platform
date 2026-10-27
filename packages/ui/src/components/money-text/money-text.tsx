import { formatAmount, type ClientAmount } from "@ampm/core";

import { Text, type TextProps } from "../text";

export interface MoneyTextProps extends Omit<TextProps, "children"> {
  /** A client-facing amount only; the type keeps internal costs and margins out (data-model A-4). */
  readonly amount: ClientAmount;
}

/** `<MoneyText amount={clientAmount(1250000)} />` renders ₹12,500 in the current type style. */
export function MoneyText({
  amount,
  variant = "body",
  weight = "semibold",
  ...rest
}: MoneyTextProps) {
  const formatted = formatAmount(amount);
  return (
    <Text variant={variant} weight={weight} accessibilityLabel={formatted} {...rest}>
      {formatted}
    </Text>
  );
}
