import type { ReactNode } from "react";
import { View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";

import { useDeleteContact, useDeleteRoom, useDeleteVenue, useStaffHotel } from "@ampm/api-client";
import type { HotelStaffDetailView } from "@ampm/core";
import { QueryErrorState, Screen, Skeleton, SplitPane, Stack, useLayoutAt } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { ContactEditSheet } from "./contact-edit-sheet";
import { HotelRecordHeader } from "./hotel-record-header";
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

interface SectionsProps {
  readonly hotelId: string;
  readonly hotel: HotelStaffDetailView;
}

/** The hotel's room categories and event venues: the main column. */
function RoomsAndVenues({ hotelId, hotel }: SectionsProps) {
  const deleteRoom = useDeleteRoom(hotelId);
  const deleteVenue = useDeleteVenue(hotelId);
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
    </Stack>
  );
}

/**
 * The hotel's contacts (RESTRICTED-CONTACT): T5's side column from 1024, under the venues below it.
 * In the 288 column the title steps down to fit beside its action, and a contact's role, phone and
 * email wrap rather than cut off; a phone keeps its layout.
 */
function HotelContacts({ hotelId, hotel }: SectionsProps) {
  const deleteContact = useDeleteContact(hotelId);
  const isDesktop = useLayoutAt("lg");
  return (
    // Stacked, 14 more than the split's 18 keeps the phone's 32 between venues and contacts.
    <View className="mt-3.5 lg:mt-0" testID="hotel-contacts-column">
      <ManagedSection
        title="Hotel contacts"
        items={hotel.contacts}
        summaryOf={contactSummary}
        summaryLines={isDesktop ? 3 : 1}
        compact={isDesktop}
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
    </View>
  );
}

/** Rooms and venues beside the contacts; every section stays in its slot at every width. */
function HotelSubresources({ hotelId, hotel }: SectionsProps) {
  return (
    <SplitPane
      sideWidth="sm"
      side={<HotelContacts hotelId={hotelId} hotel={hotel} />}
      testID="details-split"
    >
      <RoomsAndVenues hotelId={hotelId} hotel={hotel} />
    </SplitPane>
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
 * sent to clients — and sit in T5's side column from 1024. Hotel team and Super Admin only, gated
 * server-side.
 *
 *   <HotelDetailsScreen hotelId={id} tabBar={<AppTabBar />} />
 */
export function HotelDetailsScreen({ hotelId, tabBar }: HotelDetailsScreenProps) {
  const hotel = useStaffHotel(hotelId);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<HotelRecordHeader hotelId={hotelId} section="details" hotel={hotel.data} />}
    >
      <HotelDetailsBody hotelId={hotelId} hotel={hotel} />
    </Screen>
  );
}
