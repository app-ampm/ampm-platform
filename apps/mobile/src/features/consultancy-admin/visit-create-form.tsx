import { useState } from "react";

import { useCreateSiteVisit } from "@ampm/api-client";
import { InternalPanel, useToast } from "@ampm/ui";

import { errorMessage, isIsoDate, isoDateTimeFromDate } from "./consultancy-admin.form";
import { DateInput, FormCard, FormInput } from "./consultancy-admin.form-widgets";

function useVisitForm(enquiryId: string, onDone: () => void) {
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
  return { date, setDate, attendees, setAttendees, ready, pending: create.isPending, submit };
}

/**
 * Staff schedules a new site visit on the enquiry (SA/HT). A date is enough for the demo; the service
 * records it at midnight and advances the enquiry to `visit_scheduled`. Attendees are INTERNAL (absent
 * from the client view), so they are typed inside an InternalPanel.
 */
export function VisitCreateForm({
  enquiryId,
  onDone,
}: {
  readonly enquiryId: string;
  readonly onDone: () => void;
}) {
  const form = useVisitForm(enquiryId, onDone);
  return (
    <FormCard
      title="New site visit"
      description="It starts as proposed; confirm it from its card once the hotel agrees."
      submitLabel="Schedule visit"
      ready={form.ready}
      pending={form.pending}
      onSubmit={form.submit}
      onCancel={onDone}
      testID="visit-create-form"
    >
      <VisitFields form={form} />
    </FormCard>
  );
}

function VisitFields({ form }: { readonly form: ReturnType<typeof useVisitForm> }) {
  return (
    <>
      <DateInput
        label="Date"
        field="visit date"
        required
        testID="visit-date"
        value={form.date}
        onChangeText={form.setDate}
        placeholder="2027-01-20"
        helpText="YYYY-MM-DD"
      />
      <InternalPanel className="rounded" testID="visit-form-internal">
        <FormInput
          label="Attendees"
          multiline
          testID="visit-attendees"
          value={form.attendees}
          onChangeText={form.setAttendees}
          placeholder="Couple, planner, hotel GM"
          helpText="Optional"
        />
      </InternalPanel>
    </>
  );
}
