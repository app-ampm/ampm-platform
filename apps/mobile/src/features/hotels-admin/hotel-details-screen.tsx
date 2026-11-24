import type { ReactNode } from "react";
import { View } from "react-native";
import type { UseQueryResult } from "@tanstack/react-query";

import { useDeleteContact, useDeleteRoom, useDeleteVenue, useStaffHotel } from "@ampm/api-client";
import type { HotelContactView, HotelStaffDetail } from "@ampm/core";
import { QueryErrorState, Screen, Skeleton, SplitPane, Stack, useLayoutAt } from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelRequestPanel } from "../hotel-info-requests/hotel-request-panel";
import { ContactEditSheet } from "./contact-edit-sheet";
import { HotelRecordHeader } from "./hotel-record-header";
import { HotelSavedByClients } from "./hotel-saved-by-clients";
import { ManagedSection } from "./managed-subresource-section";
import { RoomEditSheet } from "./room-edit-sheet";
import { contactSummary, roomSummary, venueSummary } from "./subresources.format";
import { useClientInterestPermissions } from "./use-client-interest-permissions";
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
  readonly hotel: HotelStaffDetail;
}

/**
 * The hotel's room categories and event venues: the main column. A row's summary (both units, the
 * venue's setting, capacities and dimensions) may wrap to a second line before it is cut off, and a
 * venue's to a third below 1024: on a phone its type, setting and area in both units can fill most of
 * two, and the capacities come after them.
 */
function RoomsAndVenues({ hotelId, hotel }: SectionsProps) {
  const deleteRoom = useDeleteRoom(hotelId);
  const deleteVenue = useDeleteVenue(hotelId);
  const isDesktop = useLayoutAt("lg");
  return (
    <Stack gap={8}>
      <ManagedSection
        title="Room categories"
        items={hotel.rooms}
        summaryOf={roomSummary}
        summaryLines={2}
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
        summaryLines={isDesktop ? 2 : 3}
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
function HotelContacts({
  hotelId,
  contacts,
}: {
  readonly hotelId: string;
  readonly contacts: readonly HotelContactView[];
}) {
  const deleteContact = useDeleteContact(hotelId);
  const isDesktop = useLayoutAt("lg");
  return (
    <View testID="hotel-contacts-column">
      <ManagedSection
        title="Hotel contacts"
        items={contacts}
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

/**
 * Rooms and venues beside the hotel's information request, the contacts and the clients who saved the
 * hotel; every section stays in its slot at every width. The request panel shows to a reader of requests
 * (D-188 §7). The contacts come only to a reader of them (D-171): for anyone else the response has none,
 * and the section is left out rather than shown empty.
 */
function HotelSubresources({ hotelId, hotel }: SectionsProps) {
  const { canReadSavedHotels, canOpenClient } = useClientInterestPermissions();
  return (
    <SplitPane
      sideWidth="sm"
      side={
        // Stacked, 14 more than the split's 18 keeps the phone's 32 between the venues and the side.
        <Stack gap={8} className="mt-3.5 lg:mt-0">
          <HotelRequestPanel hotelId={hotelId} hotel={hotel} />
          {"contacts" in hotel ? (
            <HotelContacts hotelId={hotelId} contacts={hotel.contacts} />
          ) : null}
          <HotelSavedByClients
            hotelId={hotelId}
            canRead={canReadSavedHotels}
            canOpenClient={canOpenClient}
          />
        </Stack>
      }
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
  readonly hotel: UseQueryResult<HotelStaffDetail>;
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
 * through the hotels-admin subresource endpoints. Contacts are RESTRICTED-CONTACT — never sent to
 * clients, and to staff only when their grants read them (D-171) — and sit in T5's side column from
 * 1024, above the clients who saved the hotel (a role that may read clients' saved hotels). Hotel team
 * and Super Admin only, gated server-side.
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
