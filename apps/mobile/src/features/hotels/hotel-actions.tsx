import { useRouter } from "expo-router";

import { useMe, useSaveHotel, useSavedHotels, useUnsaveHotel } from "@ampm/api-client";
import type { EntitlementModule, HotelView } from "@ampm/core";
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

/** Whether the hotel is on the shortlist, and the toggle that adds or removes it. */
function useShortlistToggle(hotel: HotelView) {
  const toast = useToast();
  const saved = useSavedHotels();
  const save = useSaveHotel(hotel.id);
  const unsave = useUnsaveHotel(hotel.id);
  const isSaved = saved.items.some((item) => item.hotel.id === hotel.id);
  const toggle = (): void => {
    const mutation = isSaved ? unsave : save;
    mutation.mutate(undefined, {
      onError: () => toast.show({ title: "Could not update your shortlist", tone: "danger" }),
    });
  };
  return { isSaved, toggle, pending: save.isPending || unsave.isPending };
}

const savedLabel = (isSaved: boolean) => (isSaved ? "Saved to shortlist" : "Save hotel");

/**
 * The shortlist toggle as the footer's gold action, for an account that may save but not ask for
 * availability. Saved, it turns peacock, the colour of what is selected (D6 "Saved"); pressing it again
 * removes the hotel.
 */
export function SaveButton({ hotel }: { readonly hotel: HotelView }) {
  const { isSaved, toggle, pending } = useShortlistToggle(hotel);
  return (
    <Button
      variant={isSaved ? "highlight" : "primary"}
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
 * check: a glass circle, peacock once the hotel is saved (D6 "♥ Saved").
 */
export function SaveHeartButton({ hotel }: { readonly hotel: HotelView }) {
  const { isSaved, toggle, pending } = useShortlistToggle(hotel);
  return (
    <Button
      variant={isSaved ? "highlight" : "glass"}
      icon="heart"
      loading={pending}
      accessibilityLabel={savedLabel(isSaved)}
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
