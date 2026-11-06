import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRequestHotelAssistance } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Callout, Input, Row, Stack, Text, useToast } from "@ampm/ui";

/** CP-07: open a hotel-assistance enquiry for a discovered hotel — dates and party size, then the hotel
 *  team takes it forward. A demo prospect's request is routed to Sales instead (P-7), handled on success. */
export function NewRequestScreen({ hotelId }: { readonly hotelId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const request = useRequestHotelAssistance();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [guests, setGuests] = useState("");
  const [functions, setFunctions] = useState("");

  const guestCount = Number.parseInt(guests, 10);
  const datesEntered = dateFrom.trim() !== "" && dateTo.trim() !== "";
  // Check-out on or after check-in; string compare is chronological for valid YYYY-MM-DD values.
  const datesValid =
    isIsoDate(dateFrom.trim()) && isIsoDate(dateTo.trim()) && dateTo.trim() >= dateFrom.trim();
  const ready = datesEntered && datesValid && Number.isInteger(guestCount) && guestCount >= 1;

  const onSubmit = (): void => {
    if (!ready || request.isPending) return;
    request.mutate(
      {
        hotelId,
        dateFrom: dateFrom.trim(),
        dateTo: dateTo.trim(),
        datesFlexible: false,
        guestEstimate: guestCount,
        roomsRequired: null,
        functionsSummary: functions.trim().length > 0 ? functions.trim() : null,
        contactPreference: null,
        notesClient: null,
      },
      {
        onSuccess: (result) => {
          if (result.kind === "enquiry") {
            router.replace(`/portal/requests/${result.enquiry.id}`);
          } else {
            toast.show({ title: "We've passed your request to our team", tone: "success" });
            router.back();
          }
        },
        onError: () => toast.show({ title: "Could not send your request", tone: "danger" }),
      },
    );
  };

  const errorText =
    request.isError && isAppError(request.error) ? request.error.message : undefined;

  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Row justify="start">
        <Button variant="ghost" size="sm" icon="arrow-left" onPress={() => router.back()}>
          Back
        </Button>
      </Row>
      <Stack gap={1}>
        <Text variant="title">Request hotel assistance</Text>
        <Text tone="muted">
          Share your dates and party size; our hotel team takes it from there.
        </Text>
      </Stack>
      {errorText ? <Callout kind="danger" title={errorText} /> : null}
      {datesEntered && !datesValid ? (
        <Callout
          kind="info"
          title="Enter the dates as YYYY-MM-DD, with check-out on or after check-in."
        />
      ) : null}
      <Input
        label="Check-in (YYYY-MM-DD)"
        value={dateFrom}
        onChangeText={setDateFrom}
        placeholder="2027-02-14"
        autoCapitalize="none"
      />
      <Input
        label="Check-out (YYYY-MM-DD)"
        value={dateTo}
        onChangeText={setDateTo}
        placeholder="2027-02-16"
        autoCapitalize="none"
      />
      <Input
        label="Approx. guests"
        value={guests}
        onChangeText={setGuests}
        placeholder="120"
        keyboardType="number-pad"
      />
      <Input
        label="Functions (optional)"
        value={functions}
        onChangeText={setFunctions}
        placeholder="Sangeet, wedding, reception"
      />
      <Button fullWidth loading={request.isPending} disabled={!ready} onPress={onSubmit}>
        Send request
      </Button>
    </ScrollView>
  );
}

/** A real YYYY-MM-DD calendar date, matching the server's `z.iso.date()` (rejects e.g. 2027-02-30). */
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
