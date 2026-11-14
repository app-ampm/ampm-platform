import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useHotelRateCards, useStaffHotel } from "@ampm/api-client";
import type { RateCardView } from "@ampm/core";
import {
  Button,
  EmptyState,
  QueryErrorState,
  Row,
  Screen,
  Skeleton,
  SplitPane,
  Stack,
  Text,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelRatesSide } from "./hotel-rates-side";
import { HotelRecordHeader } from "./hotel-record-header";
import { RateCardEditSheet } from "./rate-card-edit-sheet";
import { RateCardPanel } from "./rate-card-panel";

function RatesLoading() {
  return (
    <Stack gap={4} testID="rates-loading">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </Stack>
  );
}

/** The list's heading and its gold action: add a rate card. */
function RatesHeading({ onAdd }: { readonly onAdd: () => void }) {
  return (
    <Row justify="between" align="center">
      <Text variant="heading">Rate cards</Text>
      <Button variant="primary" size="sm" icon="plus" onPress={onAdd} testID="rate-card-add">
        Add rate card
      </Button>
    </Row>
  );
}

/** The rate cards with an action to add one; each card manages its own items, verify and deletes. */
function HotelRatesList({
  hotelId,
  cards,
}: {
  readonly hotelId: string;
  readonly cards: readonly RateCardView[];
}) {
  const [creating, setCreating] = useState(false);
  return (
    <Stack gap={6}>
      <RatesHeading onAdd={() => setCreating(true)} />
      {cards.length === 0 ? (
        <EmptyState
          icon="receipt"
          title="No rate cards yet"
          description="Add a rate card to record this hotel's pricing. Nothing reaches clients until a card is verified."
        />
      ) : (
        <Stack gap={4}>
          {cards.map((card) => (
            <RateCardPanel key={card.id} hotelId={hotelId} card={card} />
          ))}
        </Stack>
      )}
      <RateCardEditSheet
        hotelId={hotelId}
        open={creating}
        card={null}
        onClose={() => setCreating(false)}
      />
    </Stack>
  );
}

function HotelRatesBody({
  hotelId,
  cards,
}: {
  readonly hotelId: string;
  readonly cards: UseQueryResult<RateCardView[]>;
}) {
  const goToSignIn = useGoToSignIn();
  if (cards.isPending) return <RatesLoading />;
  if (cards.isError) {
    return (
      <QueryErrorState
        error={cards.error}
        onRetry={() => void cards.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to manage rates",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  return <HotelRatesList hotelId={hotelId} cards={cards.data} />;
}

export interface HotelRatesScreenProps {
  readonly hotelId: string;
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel pricing workspace (feature 9.2): a hotel's rate cards and their items, with inline add /
 * edit / remove and a verify action that publishes a card. Rate `source` and notes are staff-only; a card
 * reaches client discovery only once it is verified and its items are client-visible. HT / SA only.
 * From 1024 the cards sit beside T5's 300 column (verification, media rights); below it the column
 * follows them. The cards stay in the same slot at every width, so an open editor survives a resize.
 *
 *   <HotelRatesScreen hotelId={id} tabBar={<AppTabBar />} />
 */
export function HotelRatesScreen({ hotelId, tabBar }: HotelRatesScreenProps) {
  const hotel = useStaffHotel(hotelId);
  const cards = useHotelRateCards(hotelId);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<HotelRecordHeader hotelId={hotelId} section="rates" hotel={hotel.data} />}
    >
      <SplitPane sideWidth="sm" side={<HotelRatesSide hotelId={hotelId} />} testID="rates-split">
        <HotelRatesBody hotelId={hotelId} cards={cards} />
      </SplitPane>
    </Screen>
  );
}
