import { useRouter } from "expo-router";
import { useState } from "react";

import { useHotel } from "@ampm/api-client";
import type { HotelDetailView } from "@ampm/core";
import { QueryErrorState, Row, Screen, Skeleton, Stack, useLayoutAt } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { SaveHeartButton, useHotelPagePermissions } from "./hotel-actions";
import { HotelDesktopPage } from "./hotel-desktop-page";
import { HotelFooter } from "./hotel-footer";
import { HotelBackButton, HotelHero, HotelHeroFrame } from "./hotel-hero";
import { HotelPanel } from "./hotel-panel";
import type { HotelSection } from "./hotels.format";

const NOT_FOUND = {
  title: "Hotel not found",
  description: "This hotel is not available to you.",
};

/**
 * A single hotel the client unlocked (Module C; D6 and P4 hotel page). On a phone and a tablet (P4): the
 * photo with the back button over it, the glass panel with the name, facts and sections, and a sticky
 * bar with the price and the page's one gold action. On a desktop (D6): the photo mosaic, the title
 * with the actions on the background, and the sections beside the rates. Loading keeps the page's
 * shape; failures keep the back button.
 */
export function HotelDetailScreen({ hotelId }: { readonly hotelId: string }) {
  const router = useRouter();
  const goToSignIn = useGoToSignIn();
  const hotel = useHotel(hotelId);
  const isDesktop = useLayoutAt("lg");
  const onBack = () => router.back();
  if (hotel.isSuccess)
    return <HotelPage hotel={hotel.data} isDesktop={isDesktop} onBack={onBack} />;
  if (hotel.isError)
    return (
      <Screen glow="top" width="content" header={<BackRow onBack={onBack} />}>
        <QueryErrorState
          error={hotel.error}
          onRetry={() => void hotel.refetch()}
          onSignIn={goToSignIn}
          signIn={{ title: "Sign in to view this hotel" }}
          notFound={NOT_FOUND}
        />
      </Screen>
    );
  return (
    <Screen glow="top" width={isDesktop ? "split" : "content"}>
      <DetailLoading onBack={onBack} />
    </Screen>
  );
}

interface HotelPageProps {
  readonly hotel: HotelDetailView;
  readonly isDesktop: boolean;
  readonly onBack: () => void;
}

/**
 * The loaded page. A desktop composes D6 on the `split` width, its mosaic lined up with the portal bar,
 * with no sticky bar. A phone or a tablet keeps P4 in one centred column: an account that may ask for
 * availability gets that as the footer's gold action and the save as a heart over the photo; one that
 * may only save keeps the save in the footer. The two are different trees, so the picked tab lives
 * here, above the switch: a tablet turning or a window resizing across 1024 keeps it.
 */
function HotelPage({ hotel, isDesktop, onBack }: HotelPageProps) {
  const permissions = useHotelPagePermissions();
  const [picked, setPicked] = useState<HotelSection | undefined>(undefined);
  if (isDesktop)
    return (
      <Screen glow="top" width="split">
        <HotelDesktopPage
          hotel={hotel}
          permissions={permissions}
          onBack={onBack}
          picked={picked}
          onPick={setPicked}
        />
      </Screen>
    );
  const heart =
    permissions.canRequest && permissions.canSave ? <SaveHeartButton hotel={hotel} /> : undefined;
  return (
    <Screen
      glow="top"
      width="content"
      footer={<HotelFooter hotel={hotel} permissions={permissions} />}
    >
      <HotelHero hotel={hotel} onBack={onBack} trailing={heart} />
      <HotelPanel hotel={hotel} picked={picked} onPick={setPicked} />
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
