import type { HotelEnquiryClientDetailView } from "@ampm/core";
import { Card, Stack, Stepper, Text } from "@ampm/ui";

import { ENQUIRY_STEPS, enquiryFacts, enquiryStep } from "./consultancy.format";
import { EnquiryAbout } from "./enquiry-about";
import { EnquiryHead } from "./enquiry-head";
import { BARE_CARD, useInDetailPanel } from "./enquiry-surface";

/**
 * The top of an enquiry (D8): the stay, the status stepper (submitted, checking, available, proposal
 * shared, your decision), then what the client told us: the functions and their own note, which the
 * client can edit. An enquiry closed without a booking has no stepper; its chip says how it closed.
 * On a phone and a tablet it is a glass card under the page header, the stay as its first line; in the
 * desktop panel it has no frame of its own and opens with the panel's head (name, stay, chip). The
 * same elements at both, so an open note editor survives the window crossing 1024.
 */
export function EnquirySummary({ enquiry }: { readonly enquiry: HotelEnquiryClientDetailView }) {
  const inPanel = useInDetailPanel();
  const step = enquiryStep(enquiry);
  return (
    <Card
      padding={inPanel ? "none" : "lg"}
      tone={inPanel ? "flat" : "glass"}
      className={inPanel ? BARE_CARD : undefined}
      testID={inPanel ? undefined : "enquiry-summary"}
    >
      <Stack gap={4.5} className={inPanel ? "gap-5" : undefined}>
        {inPanel ? (
          <EnquiryHead enquiry={enquiry} />
        ) : (
          <Text variant="data" tone="muted" className="uppercase">
            {enquiryFacts(enquiry)}
          </Text>
        )}
        {step === null ? null : (
          <Stepper steps={ENQUIRY_STEPS} current={step} testID="enquiry-stepper" />
        )}
        <EnquiryAbout enquiry={enquiry} />
      </Stack>
    </Card>
  );
}
