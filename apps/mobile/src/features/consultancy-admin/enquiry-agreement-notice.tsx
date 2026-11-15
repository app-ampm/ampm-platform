import { useStaffServiceAgreements } from "@ampm/api-client";
import { Callout } from "@ampm/ui";

/**
 * Tells the team, at the top of the enquiry, when a service agreement on it has been accepted (by the
 * client in the portal, or recorded as signed offline) and is waiting to be activated: activating is the
 * team's step that starts the paid work and unlocks the chargeable stages, and until now nothing on the
 * enquiry said so. Reads the same agreements query as the Booking tab (which re-reads every 20 seconds
 * while one waits on the client), so a client's accept shows up here without a reload. Renders nothing
 * while none waits, and nothing for a role the agreements read is refused to.
 */
export function EnquiryAgreementNotice({
  enquiryId,
  onOpenBooking,
  blur,
}: {
  readonly enquiryId: string;
  /** Opens the Booking tab; omitted while it is the open tab. */
  readonly onOpenBooking?: (() => void) | undefined;
  readonly blur: boolean;
}) {
  const agreements = useStaffServiceAgreements({ hotelEnquiryId: enquiryId });
  const waiting = agreements.data?.items.filter((agreement) => agreement.status === "accepted");
  const first = waiting?.[0];
  if (!first) return null;
  const how = first.acceptedByUserId ? "The client accepted" : "Recorded as signed offline:";
  const title =
    waiting.length === 1
      ? `${how} the ${first.serviceName} agreement`
      : `${waiting.length} accepted agreements are waiting to be activated`;
  return (
    <Callout
      kind="danger"
      title={title}
      blur={blur}
      action={
        onOpenBooking ? { label: "Activate it in Booking", onPress: onOpenBooking } : undefined
      }
      testID="enquiry-agreement-notice"
    >
      Activate it to start the paid work. Until then the paid stages stay locked.
    </Callout>
  );
}
