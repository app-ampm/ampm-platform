import { useRouter } from "expo-router";

import { useHotel } from "@ampm/api-client";
import { Callout, Screen, ScreenHeader } from "@ampm/ui";

import { NewRequestForm } from "./new-request-form";
import { useNewRequest, type NewRequestForm as NewRequestFormState } from "./use-new-request";

/** Why the last send failed: offline (peacock, the form is kept), or the API's refusal (gold). */
function SendNotice({ form }: { readonly form: NewRequestFormState }) {
  if (form.isOffline) {
    return (
      <Callout kind="offline">
        Your request has not been sent. Send it again once you are back online.
      </Callout>
    );
  }
  return form.errorText ? <Callout kind="danger" title={form.errorText} /> : null;
}

/**
 * CP-07: open a hotel-assistance enquiry for a discovered hotel: dates and party size, then the hotel
 * team takes it forward. A form screen: a back button, no tab bar. The eyebrow names the hotel once its
 * detail is at hand (the hotel page the person came from has usually loaded it already).
 */
export function NewRequestScreen({ hotelId }: { readonly hotelId: string }) {
  const router = useRouter();
  const hotel = useHotel(hotelId);
  const form = useNewRequest(hotelId);
  return (
    <Screen
      width="content"
      header={
        <ScreenHeader
          eyebrow={hotel.data?.name}
          title="Request hotel assistance"
          subtitle="Share your dates and party size; our hotel team takes it from there."
          onBack={() => router.back()}
        />
      }
    >
      <SendNotice form={form} />
      <NewRequestForm form={form} />
    </Screen>
  );
}
