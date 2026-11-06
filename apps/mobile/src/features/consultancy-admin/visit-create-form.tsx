import { useState } from "react";

import { useCreateSiteVisit } from "@ampm/api-client";
import { Button, Card, Input, Row, Stack, Text, useToast } from "@ampm/ui";

import { errorMessage, isIsoDate, isoDateTimeFromDate } from "./consultancy-admin.form";

/**
 * Staff schedules a new site visit on the enquiry (SA/HT). A date is enough for the demo; the service
 * records it at midnight and advances the enquiry to `visit_scheduled`. Attendees are internal-only.
 */
export function VisitCreateForm({
  enquiryId,
  onDone,
}: {
  readonly enquiryId: string;
  readonly onDone: () => void;
}) {
  const toast = useToast();
  const create = useCreateSiteVisit(enquiryId);
  const [date, setDate] = useState("");
  const [attendees, setAttendees] = useState("");
  const ready = isIsoDate(date.trim());

  const submit = (): void => {
    if (!ready || create.isPending) return;
    create.mutate(
      {
        enquiryId,
        scheduledAt: isoDateTimeFromDate(date.trim()),
        attendeesText: attendees.trim().length > 0 ? attendees.trim() : null,
      },
      {
        onSuccess: () => {
          toast.show({ title: "Site visit scheduled", tone: "success" });
          onDone();
        },
        onError: (error) =>
          toast.show({
            title: errorMessage(error, "Could not schedule the visit"),
            tone: "danger",
          }),
      },
    );
  };

  return (
    <Card>
      <Stack gap={3}>
        <Text variant="subheading">New site visit</Text>
        <Input
          label="Date (YYYY-MM-DD)"
          value={date}
          onChangeText={setDate}
          placeholder="2027-01-20"
          autoCapitalize="none"
        />
        <Input
          label="Attendees (internal, optional)"
          value={attendees}
          onChangeText={setAttendees}
          placeholder="Couple, planner, hotel GM"
          multiline
        />
        <Row gap={2}>
          <Button fullWidth loading={create.isPending} disabled={!ready} onPress={submit}>
            Schedule
          </Button>
          <Button variant="ghost" disabled={create.isPending} onPress={onDone}>
            Cancel
          </Button>
        </Row>
      </Stack>
    </Card>
  );
}
