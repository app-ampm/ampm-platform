import { useRouter } from "expo-router";

import { useHotel } from "@ampm/api-client";
import type { HotelDetailView } from "@ampm/core";
import { Row, Screen, Skeleton, Stack } from "@ampm/ui";

import { SaveHeartButton, useHotelPagePermissions } from "./hotel-actions";
import { HotelFooter } from "./hotel-footer";
import { HotelBackButton, HotelHero, HotelHeroFrame } from "./hotel-hero";
import { HotelPanel } from "./hotel-panel";
import { HotelsQueryError } from "./hotels-query-error";

const NOT_FOUND = {
  title: "Hotel not found",
  description: "This hotel is not available to you.",
};

/**
 * A single hotel the client unlocked (Module C; D6 and P4 hotel page): the photo with the back button
 * over it, the glass panel with the name, facts and sections, and a sticky bar with the price and the
 * page's one gold action. Loading keeps the page's shape; failures keep the back button.
 */
export function HotelDetailScreen({ hotelId }: { readonly hotelId: string }) {
  const router = useRouter();
  const hotel = useHotel(hotelId);
  const onBack = () => router.back();
  if (hotel.isSuccess) return <HotelPage hotel={hotel.data} onBack={onBack} />;
  if (hotel.isError)
    return (
      <Screen glow="top" width="content" header={<BackRow onBack={onBack} />}>
        <HotelsQueryError
          error={hotel.error}
          onRetry={() => void hotel.refetch()}
          signInTitle="Sign in to view this hotel"
          notFound={NOT_FOUND}
        />
      </Screen>
    );
  return (
    <Screen glow="top" width="content">
      <DetailLoading onBack={onBack} />
    </Screen>
  );
}

/**
 * The loaded page. An account that may ask for availability gets that as the footer's gold action and
 * the save as a heart over the photo (P4); one that may only save keeps the save in the footer.
 */
function HotelPage({
  hotel,
  onBack,
}: {
  readonly hotel: HotelDetailView;
  readonly onBack: () => void;
}) {
  const permissions = useHotelPagePermissions();
  const heart =
    permissions.canRequest && permissions.canSave ? <SaveHeartButton hotel={hotel} /> : undefined;
  return (
    <Screen
      glow="top"
      width="content"
      footer={<HotelFooter hotel={hotel} permissions={permissions} />}
    >
      <HotelHero hotel={hotel} onBack={onBack} trailing={heart} />
      <HotelPanel hotel={hotel} />
    </Screen>
  );
}

function BackRow({ onBack }: { readonly onBack: () => void }) {
  return (
    <Row>
      <HotelBackButton onPress={onBack} />
    </Row>
  );
}

/** The page's shape while the hotel loads: the hero and the panel as skeletons, the back button live. */
function DetailLoading({ onBack }: { readonly onBack: () => void }) {
  return (
    <Stack gap={4} testID="hotel-detail-loading">
      <HotelHeroFrame onBack={onBack}>
        <Skeleton className="h-full w-full rounded-none" />
      </HotelHeroFrame>
      <Skeleton className="h-64 w-full rounded-lg" />
    </Stack>
  );
}
