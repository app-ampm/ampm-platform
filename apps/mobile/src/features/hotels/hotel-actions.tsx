import { useRouter } from "expo-router";

import { useMe, useSaveHotel, useSavedHotelIds, useUnsaveHotel } from "@ampm/api-client";
import { HOTEL_COMPARE_MIN, type EntitlementModule, type HotelView } from "@ampm/core";
import { Button, useToast } from "@ampm/ui";

/** What the account may do from the hotel page. The interface only hides; the server still decides. */
export interface HotelPagePermissions {
  /** It keeps a shortlist it may change (a read-only one, after a downgrade, shows no save). */
  readonly canSave: boolean;
  /** It may open a hotel-assistance request (CP-07), which is a write too. */
  readonly canRequest: boolean;
}

/** The hotel page's actions from `/me`; none while it loads or when it fails. */
export function useHotelPagePermissions(): HotelPagePermissions {
  const me = useMe();
  const modules = me.data?.entitlements.modules ?? [];
  const readOnly = me.data?.entitlements.readOnlyModules ?? [];
  const writes = (module: EntitlementModule) =>
    modules.includes(module) && !readOnly.includes(module);
  return { canSave: writes("saved_hotels"), canRequest: writes("hotel_assistance") };
}

/**
 * Whether the hotel is on the shortlist, and the toggle that adds or removes it. `isSaved` comes from the
 * complete saved-ids lookup (useSavedHotelIds), so a hotel saved anywhere on the shortlist — not only its
 * first page — reads as saved. While the lookup loads or if it fails the hotel reads as unsaved, a brief and
 * benign default (saving again is a server-idempotent no-op). Saving or removing invalidates the
 * `["hotels","saved"]` prefix, which the ids lookup shares, so the heart flips once the mutation settles.
 */
function useShortlistToggle(hotel: HotelView) {
  const toast = useToast();
  const savedIds = useSavedHotelIds();
  const save = useSaveHotel(hotel.id);
  const unsave = useUnsaveHotel(hotel.id);
  const isSaved = savedIds.ids.has(hotel.id);
  const toggle = (): void => {
    const mutation = isSaved ? unsave : save;
    mutation.mutate(undefined, {
      onError: () => toast.show({ title: "Could not update your shortlist", tone: "danger" }),
    });
  };
  return { isSaved, toggle, pending: save.isPending || unsave.isPending };
}

/** The heart/button label. In a repeated LIST control (B12) a hotel name makes each action's target unambiguous (WCAG 2.4.4); the single detail page omits it. */
const savedLabel = (isSaved: boolean, hotelName?: string): string =>
  hotelName
    ? isSaved
      ? `${hotelName} saved to shortlist`
      : `Save ${hotelName}`
    : isSaved
      ? "Saved to shortlist"
      : "Save hotel";

export interface SaveButtonProps {
  readonly hotel: HotelView;
  /**
   * True (default) when the save is the page's one gold action; false beside a gold "Check
   * availability" (D6's title actions), where an unsaved hotel shows the pearl outline instead.
   */
  readonly primary?: boolean | undefined;
}

/**
 * The shortlist toggle as a labelled pill: the footer's gold action for an account that may save but
 * not ask for availability, or D6's "Saved" beside the title. Saved, it turns peacock, the colour of
 * what is selected (D6 "Saved"); pressing it again removes the hotel.
 */
export function SaveButton({ hotel, primary = true }: SaveButtonProps) {
  const { isSaved, toggle, pending } = useShortlistToggle(hotel);
  return (
    <Button
      variant={isSaved ? "highlight" : primary ? "primary" : "secondary"}
      icon="heart"
      loading={pending}
      onPress={toggle}
      className="self-center"
    >
      {savedLabel(isSaved)}
    </Button>
  );
}

/**
 * The same toggle as P4's heart over the photo, when the footer's gold action is the availability
 * check: a glass circle, peacock once the hotel is saved (D6 "♥ Saved"). On a result card (B12) pass
 * `namedLabel` so the accessible name carries the hotel, since the list repeats the control (WCAG 2.4.4).
 */
export function SaveHeartButton({
  hotel,
  namedLabel = false,
}: {
  readonly hotel: HotelView;
  readonly namedLabel?: boolean;
}) {
  const { isSaved, toggle, pending } = useShortlistToggle(hotel);
  return (
    <Button
      variant={isSaved ? "highlight" : "glass"}
      icon="heart"
      loading={pending}
      accessibilityLabel={savedLabel(isSaved, namedLabel ? hotel.name : undefined)}
      onPress={toggle}
    />
  );
}

/**
 * The hotel page's one gold action for an account that may ask (D6, P4 "Check availability"): it opens
 * a hotel-assistance request for this hotel (CP-07), where the hotel team checks the dates.
 */
export function CheckAvailabilityButton({ hotel }: { readonly hotel: HotelView }) {
  const router = useRouter();
  return (
    <Button
      onPress={() => router.push(`/portal/requests/new?hotelId=${hotel.id}`)}
      className="self-center"
    >
      Check availability
    </Button>
  );
}

/**
 * D6's "Compare" beside the title: the side-by-side compare is picked from the shortlist (CP-06, the
 * compare endpoint only takes saved hotels), so it opens the shortlist, and shows only once this hotel
 * is on it with at least one other to compare it with.
 */
export function CompareButton({ hotel }: { readonly hotel: HotelView }) {
  const router = useRouter();
  const savedIds = useSavedHotelIds();
  if (!savedIds.ids.has(hotel.id) || savedIds.ids.size < HOTEL_COMPARE_MIN) return null;
  return (
    <Button
      variant="secondary"
      accessibilityLabel="Compare on your shortlist"
      onPress={() => router.push("/hotels/saved")}
      className="self-center"
    >
      Compare
    </Button>
  );
}
