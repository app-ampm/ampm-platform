import { View } from "react-native";

import type { ClientRateItemView, HotelRatesView } from "@ampm/core";
import { ListItem, MoneyText, Stack, StatusChip, Text } from "@ampm/ui";

import {
  hasRateAmounts,
  percentLabel,
  rateAmounts,
  rateFreshnessChip,
  rateItemLabel,
  rateUnitLabel,
} from "./hotels.format";

/**
 * The hotel's indicative pricing (D6, P4 "Rates"): its freshness first (verified with the date, the
 * stale chip, or on request), then one row per client-visible item. Stale amounts still show under
 * their label; on request shows no amounts at all (AC-04).
 */
export function HotelRates({ rates }: { readonly rates: HotelRatesView }) {
  const chip = rateFreshnessChip(rates);
  return (
    <Stack gap={3}>
      <StatusChip label={chip.label} tone={chip.tone} dot={chip.dot} />
      {hasRateAmounts(rates) ? (
        <RateList items={rates.items} />
      ) : (
        <Text variant="bodySmall">Prices for this hotel are shared on request.</Text>
      )}
    </Stack>
  );
}

function RateList({ items }: { readonly items: readonly ClientRateItemView[] }) {
  return (
    <Stack gap={3}>
      <View>
        {items.map((item, index) => (
          <RateRow key={`${item.itemType}-${index}`} item={item} />
        ))}
      </View>
      <Text variant="bodySmall" tone="muted">
        Indicative ranges, not a quote. Ask for availability and the hotel team confirms prices for
        your dates.
      </Text>
    </Stack>
  );
}

/** One item as the kit's plain row: its name, what the amount is for, and the amount at the end. */
function RateRow({ item }: { readonly item: ClientRateItemView }) {
  const detail = [rateUnitLabel(item.unit), item.inclusions].filter(Boolean).join(" · ");
  return (
    <ListItem
      tone="plain"
      title={rateItemLabel(item.itemType)}
      subtitle={detail || undefined}
      trailing={<RateValue item={item} />}
    />
  );
}

/** A row's amount: a client amount or range in rupees, or a percentage for taxes and charges. */
function RateValue({ item }: { readonly item: ClientRateItemView }) {
  if (item.unit === "percent") return <Text variant="data">{percentLabel(item)}</Text>;
  const { amount, amountMax } = rateAmounts(item);
  return <MoneyText amount={amount} amountMax={amountMax} />;
}
