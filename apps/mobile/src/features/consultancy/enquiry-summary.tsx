import { useState } from "react";

import { useUpdateEnquiryNote } from "@ampm/api-client";
import type { HotelEnquiryClientDetailView } from "@ampm/core";
import { Button, Card, Row, Stack, Stepper, Text, useToast } from "@ampm/ui";

import { NoteEditorSheet } from "@/components/note-editor-sheet";

import { ENQUIRY_STEPS, enquiryFacts, enquiryStep } from "./consultancy.format";

/** The longest note the API accepts (hotelEnquiryClientUpdateRequest); the editor caps input at the same length. */
const ENQUIRY_NOTE_MAX = 4000;

function Note({ label, text }: { readonly label: string; readonly text: string }) {
  return (
    <Stack gap={1}>
      <Text variant="eyebrow">{label}</Text>
      <Text>{text}</Text>
    </Stack>
  );
}

/** The editing state and the save for the enquiry note; a blank field clears the note (saves null). */
function useEnquiryNote(enquiry: HotelEnquiryClientDetailView) {
  const toast = useToast();
  const update = useUpdateEnquiryNote(enquiry.id);
  const [editing, setEditing] = useState(false);
  const save = (value: string | null): void =>
    update.mutate(
      { notesClient: value },
      {
        onSuccess: () => setEditing(false),
        onError: () => toast.show({ title: "Could not save your note", tone: "danger" }),
      },
    );
  return {
    editing,
    open: () => setEditing(true),
    close: () => setEditing(false),
    save,
    saving: update.isPending,
  };
}

/**
 * The client's own note on an enquiry (B19 / CP-09): tell AMPM more about this request, or clear it. The
 * note and the `PATCH /consultancy/enquiries/:id` endpoint already exist; this adds the editor through the
 * shared note sheet. Offered only while the enquiry is live — a closed enquiry is read-only on the server
 * (updateOwnNote returns 409), so its note still shows but cannot be edited.
 */
function EnquiryNote({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  const { editing, open, close, save, saving } = useEnquiryNote(enquiry);
  if (enquiry.status === "closed") {
    return enquiry.notesClient ? <Note label="Your note" text={enquiry.notesClient} /> : null;
  }
  return (
    <Stack gap={1}>
      <Row gap={2} justify="between">
        <Text variant="eyebrow">Your note</Text>
        <Button
          variant="ghost"
          size="sm"
          icon="edit"
          onPress={open}
          accessibilityLabel={enquiry.notesClient ? "Edit your note" : "Add a note"}
        />
      </Row>
      {enquiry.notesClient ? (
        <Text>{enquiry.notesClient}</Text>
      ) : (
        <Text tone="muted">Add a note to tell AMPM more about this request.</Text>
      )}
      <NoteEditorSheet
        open={editing}
        onClose={close}
        title="Your note"
        initialNote={enquiry.notesClient}
        onSave={save}
        saving={saving}
        maxLength={ENQUIRY_NOTE_MAX}
        placeholder="e.g. we can be flexible on the dates"
        testID="enquiry-note-sheet"
      />
    </Stack>
  );
}

/**
 * The top panel of an enquiry (D8): the stay as one data line, the status stepper (submitted, checking,
 * available, proposal shared, your decision), then what the client told us: the functions and their own
 * note, which the client can edit. An enquiry closed without a booking has no stepper; its chip in the
 * header says how it closed.
 */
export function EnquirySummary({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  const step = enquiryStep(enquiry);
  return (
    <Card padding="lg" testID="enquiry-summary">
      <Stack gap={4.5}>
        <Text variant="data" tone="muted" className="uppercase">
          {enquiryFacts(enquiry)}
        </Text>
        {step === null ? null : (
          <Stepper steps={ENQUIRY_STEPS} current={step} testID="enquiry-stepper" />
        )}
        {enquiry.functionsSummary ? (
          <Note label="Functions" text={enquiry.functionsSummary} />
        ) : null}
        <EnquiryNote enquiry={enquiry} />
      </Stack>
    </Card>
  );
}
