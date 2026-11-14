import { Button, Card, Checkbox, Input, Stack } from "@ampm/ui";

import type { NewRequestForm as NewRequestFormState } from "./use-new-request";

interface FieldsProps {
  readonly form: NewRequestFormState;
}

/** Check-in and check-out, each with its inline gold error, and whether the dates can move. */
function StayFields({ form: { draft, update, errors } }: FieldsProps) {
  return (
    <>
      <Input
        label="Check-in (YYYY-MM-DD)"
        value={draft.dateFrom}
        onChangeText={(value) => update("dateFrom", value)}
        placeholder="2027-02-14"
        autoCapitalize="none"
        errorText={errors.dateFrom}
        required
      />
      <Input
        label="Check-out (YYYY-MM-DD)"
        value={draft.dateTo}
        onChangeText={(value) => update("dateTo", value)}
        placeholder="2027-02-16"
        autoCapitalize="none"
        errorText={errors.dateTo}
        required
      />
      <Checkbox
        label="My dates are flexible"
        checked={draft.datesFlexible}
        onCheckedChange={(checked) => update("datesFlexible", checked)}
      />
    </>
  );
}

/** The party size, the optional room count with its inline error, and optionally the functions. */
function PartyFields({ form: { draft, update, errors } }: FieldsProps) {
  return (
    <>
      <Input
        label="Approx. guests"
        value={draft.guests}
        onChangeText={(value) => update("guests", value)}
        placeholder="120"
        keyboardType="number-pad"
        required
      />
      <Input
        label="Rooms needed (optional)"
        value={draft.rooms}
        onChangeText={(value) => update("rooms", value)}
        placeholder="40"
        keyboardType="number-pad"
        maxLength={4}
        errorText={errors.rooms}
      />
      <Input
        label="Functions (optional)"
        value={draft.functions}
        onChangeText={(value) => update("functions", value)}
        placeholder="Sangeet, wedding, reception"
        multiline
        maxLength={2000}
      />
    </>
  );
}

/** How the client would like the hotel team to reach them, and anything else they want to add. */
function ContactFields({ form: { draft, update } }: FieldsProps) {
  return (
    <>
      <Input
        label="Preferred contact (optional)"
        value={draft.contactPreference}
        onChangeText={(value) => update("contactPreference", value)}
        placeholder="WhatsApp, evenings after 6pm"
        maxLength={255}
      />
      <Input
        label="Anything else we should know? (optional)"
        value={draft.notes}
        onChangeText={(value) => update("notes", value)}
        placeholder="Catering, suppliers, must-have amenities"
        multiline
        maxLength={4000}
      />
    </>
  );
}

/**
 * The CP-07 form on one glass card: the stay, the party, then the screen's one gold action, disabled
 * until the request is valid and busy while it is sent.
 */
export function NewRequestForm({ form }: FieldsProps) {
  return (
    <Card padding="lg">
      <Stack gap={4}>
        <StayFields form={form} />
        <PartyFields form={form} />
        <ContactFields form={form} />
        <Button
          fullWidth
          loading={form.isSubmitting}
          disabled={!form.canSubmit}
          onPress={form.submit}
          className="mt-1"
        >
          Send request
        </Button>
      </Stack>
    </Card>
  );
}
