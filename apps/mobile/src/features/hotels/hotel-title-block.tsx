import type { HotelDetailView } from "@ampm/core";
import { Row, Stack, Text } from "@ampm/ui";

import {
  CheckAvailabilityButton,
  CompareButton,
  SaveButton,
  type HotelPagePermissions,
} from "./hotel-actions";
import { HotelFacts } from "./hotel-facts";
import { destinationLabel } from "./hotels.format";

export interface HotelTitleBlockProps {
  readonly hotel: HotelDetailView;
  readonly permissions: HotelPagePermissions;
}

/**
 * D6's actions at the title's right, the one gold action last: Saved, Compare and "Check availability"
 * for an account that may ask, or Compare and the gold save for one that may only keep a shortlist.
 */
function TitleActions({ hotel, permissions }: HotelTitleBlockProps) {
  const { canSave, canRequest } = permissions;
  return (
    <Row gap={2.5} align="center" className="shrink-0">
      {canSave && canRequest ? <SaveButton hotel={hotel} primary={false} /> : null}
      {canSave ? <CompareButton hotel={hotel} /> : null}
      {canRequest ? <CheckAvailabilityButton hotel={hotel} /> : null}
      {canSave && !canRequest ? <SaveButton hotel={hotel} /> : null}
    </Row>
  );
}

/**
 * The desktop hotel page's title on the background, not in a card (D6): where it is, the name in
 * Gilda at the page-title size, the facts as chips, and the page's actions at the right, level with
 * the chips.
 */
export function HotelTitleBlock({ hotel, permissions }: HotelTitleBlockProps) {
  return (
    <Row gap={8} justify="between" align="end" testID="hotel-title-block">
      <Stack gap={3} className="flex-1">
        <Text variant="eyebrow">{destinationLabel(hotel.destination)}</Text>
        <Text variant="display">{hotel.name}</Text>
        <HotelFacts hotel={hotel} detailed />
      </Stack>
      <TitleActions hotel={hotel} permissions={permissions} />
    </Row>
  );
}
