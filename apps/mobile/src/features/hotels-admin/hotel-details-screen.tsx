import type { ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useDeleteContact, useDeleteRoom, useDeleteVenue, useStaffHotel } from "@ampm/api-client";
import type { HotelStaffDetailView } from "@ampm/core";
import { QueryErrorState, Screen, ScreenHeader, Skeleton, Stack } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { ContactEditSheet } from "./contact-edit-sheet";
import { contactSummary, roomSummary, venueSummary } from "./hotels-admin.format";
import { ManagedSection } from "./managed-subresource-section";
import { RoomEditSheet } from "./room-edit-sheet";
import { VenueEditSheet } from "./venue-edit-sheet";

function DetailsLoading() {
  return (
    <Stack gap={4} testID="details-loading">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </Stack>
  );
}

/** The three managed sections, once the hotel (with its nested collections) has loaded. */
function HotelSubresources({
  hotelId,
  hotel,
}: {
  readonly hotelId: string;
  readonly hotel: HotelStaffDetailView;
}) {
  const deleteRoom = useDeleteRoom(hotelId);
  const deleteVenue = useDeleteVenue(hotelId);
  const deleteContact = useDeleteContact(hotelId);
  return (
    <Stack gap={8}>
      <ManagedSection
        title="Room categories"
        items={hotel.rooms}
        summaryOf={roomSummary}
        addLabel="Add room"
        emptyText="No room categories yet. Add the room types this hotel offers."
        noun="room category"
        testIdPrefix="room"
        remove={deleteRoom}
        renderEditor={({ open, item, onClose }) => (
          <RoomEditSheet hotelId={hotelId} open={open} room={item} onClose={onClose} />
        )}
      />
      <ManagedSection
        title="Venues"
        items={hotel.venues}
        summaryOf={venueSummary}
        addLabel="Add venue"
        emptyText="No venues yet. Add the event spaces this hotel offers."
        noun="venue"
        testIdPrefix="venue"
        remove={deleteVenue}
        renderEditor={({ open, item, onClose }) => (
          <VenueEditSheet hotelId={hotelId} open={open} venue={item} onClose={onClose} />
        )}
      />
      <ManagedSection
        title="Hotel contacts"
        items={hotel.contacts}
        summaryOf={contactSummary}
        tagOf={(contact) => (contact.isPrimary ? "Primary" : undefined)}
        addLabel="Add contact"
        emptyText="No contacts yet. Add the hotel's key events and reservations contacts."
        internalNote="Never shown to clients"
        noun="contact"
        testIdPrefix="contact"
        remove={deleteContact}
        renderEditor={({ open, item, onClose }) => (
          <ContactEditSheet hotelId={hotelId} open={open} contact={item} onClose={onClose} />
        )}
      />
    </Stack>
  );
}

function HotelDetailsBody({
  hotelId,
  hotel,
}: {
  readonly hotelId: string;
  readonly hotel: UseQueryResult<HotelStaffDetailView>;
}) {
  const goToSignIn = useGoToSignIn();
  if (hotel.isPending) return <DetailsLoading />;
  if (hotel.isError) {
    return (
      <QueryErrorState
        error={hotel.error}
        onRetry={() => void hotel.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to manage this hotel",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  return <HotelSubresources hotelId={hotelId} hotel={hotel.data} />;
}

export interface HotelDetailsScreenProps {
  readonly hotelId: string;
  readonly tabBar?: ReactNode;
}

/**
 * The staff hotel detail workspace (H1.1): the hotel's room categories, event venues and contacts, each
 * with inline add / edit / remove. Reads the nested collections from the staff hotel detail; writes go
 * through the hotels-admin subresource endpoints. Contacts are RESTRICTED-CONTACT — staff only, never
 * sent to clients. Hotel team and Super Admin only, gated server-side.
 *
 *   <HotelDetailsScreen hotelId={id} tabBar={<AppTabBar />} />
 */
export function HotelDetailsScreen({ hotelId, tabBar }: HotelDetailsScreenProps) {
  const router = useRouter();
  const hotel = useStaffHotel(hotelId);
  return (
    <Screen
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={hotel.data?.name ?? "Hotel"}
          title="Rooms, venues & contacts"
          onBack={() => router.back()}
        />
      }
    >
      <HotelDetailsBody hotelId={hotelId} hotel={hotel} />
    </Screen>
  );
}
