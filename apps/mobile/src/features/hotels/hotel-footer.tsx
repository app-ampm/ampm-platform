import type { HotelDetailView, HotelRatesView } from "@ampm/core";
import { MoneyText, Row, Stack, Text } from "@ampm/ui";

import { CheckAvailabilityButton, SaveButton, type HotelPagePermissions } from "./hotel-actions";
import { headlineCaption, headlineRate, rateAmounts } from "./hotels.format";

export interface HotelFooterProps {
  readonly hotel: HotelDetailView;
  readonly permissions: HotelPagePermissions;
}

/**
 * The hotel page's sticky bar (P4): the headline price on the left and the page's one gold action on
 * the right: "Check availability" for an account that may ask, otherwise the shortlist toggle.
 */
export function HotelFooter({ hotel, permissions }: HotelFooterProps) {
  return (
    <Row gap={3} justify="between">
      <HeadlinePrice rates={hotel.rates} />
      {permissions.canRequest ? (
        <CheckAvailabilityButton hotel={hotel} />
      ) : permissions.canSave ? (
        <SaveButton hotel={hotel} />
      ) : null}
    </Row>
  );
}

/** The room rate (or the next best amount) and what it is for; on request when there is none. */
function HeadlinePrice({ rates }: { readonly rates: HotelRatesView }) {
  const item = headlineRate(rates);
  if (!item)
    return (
      <Text variant="label" tone="primary" className="flex-1">
        Rates on request
      </Text>
    );
  const { amount, amountMax } = rateAmounts(item);
  return (
    <Stack gap={0} className="flex-1">
      <MoneyText amount={amount} amountMax={amountMax} variant="body" />
      <Text variant="caption">{headlineCaption(item, rates)}</Text>
    </Stack>
  );
}
