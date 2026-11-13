import { useState } from "react";

import { useWithdrawEnquiry } from "@ampm/api-client";
import { isHotelEnquiryWithdrawable, type HotelEnquiryClientDetailView } from "@ampm/core";
import { Button, ConfirmSheet, Stack, useToast } from "@ampm/ui";

/**
 * Let a client withdraw their own hotel enquiry (B19 / CP-09). Offered only while the enquiry is live (the
 * active pipeline, before it is confirmed or closed); the server closes it with outcome "withdrawn", and a
 * confirmed or closed enquiry has no action here (the server refuses one too). Destructive, so it confirms
 * first through the shared sheet.
 */
export function EnquiryWithdraw({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  const toast = useToast();
  const withdraw = useWithdrawEnquiry(enquiry.id);
  const [confirming, setConfirming] = useState(false);
  if (!isHotelEnquiryWithdrawable(enquiry.status)) return null;
  const run = (): void =>
    withdraw.mutate(undefined, {
      onSuccess: () => setConfirming(false),
      onError: () => toast.show({ title: "Could not withdraw this enquiry", tone: "danger" }),
    });
  return (
    <Stack gap={2}>
      <Button
        variant="destructive"
        onPress={() => setConfirming(true)}
        accessibilityLabel="Withdraw this enquiry"
        testID="enquiry-withdraw"
      >
        Withdraw enquiry
      </Button>
      <ConfirmSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Withdraw this enquiry?"
        description="AMPM and the hotel will stop working on it. You can send a new request for this hotel afterwards."
        confirmLabel="Withdraw enquiry"
        destructive
        loading={withdraw.isPending}
        onConfirm={run}
        testID="enquiry-withdraw-sheet"
      />
    </Stack>
  );
}
