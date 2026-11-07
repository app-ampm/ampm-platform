import type { HotelEnquiryClientDetailView } from "@ampm/core";
import { Card, Stack, Stepper, Text } from "@ampm/ui";

import { ENQUIRY_STEPS, enquiryFacts, enquiryStep } from "./consultancy.format";

function Note({ label, text }: { readonly label: string; readonly text: string }) {
  return (
    <Stack gap={1}>
      <Text variant="eyebrow">{label}</Text>
      <Text>{text}</Text>
    </Stack>
  );
}

/**
 * The top panel of an enquiry (D8): the stay as one data line, the status stepper (submitted, checking,
 * available, proposal shared, your decision), then what the client told us: the functions and their
 * note. An enquiry closed without a booking has no stepper; its chip in the header says how it closed.
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
        {enquiry.notesClient ? <Note label="Your note" text={enquiry.notesClient} /> : null}
      </Stack>
    </Card>
  );
}
