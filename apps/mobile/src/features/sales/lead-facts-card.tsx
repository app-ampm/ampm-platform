import type { LeadView } from "@ampm/core";
import { Card, Divider, Stack, Text } from "@ampm/ui";

import { LeadFactRow } from "./lead-fact-row";
import { formatStay } from "./sales.format";

const guests = (estimate: number | null): string | null =>
  estimate === null ? null : `About ${estimate}`;

/**
 * A lead's facts on glass (T3): the wedding it asks about (dates, destination, guests), where it came
 * from and who owns it, how to reach the contact, and the requirements in their own words.
 *
 *   <LeadFactsCard lead={lead} />
 */
export function LeadFactsCard({ lead }: { readonly lead: LeadView }) {
  return (
    <Card className="md:p-6" testID="lead-facts">
      <Stack gap={3}>
        <Text variant="subheading">Details</Text>
        <LeadFactRow
          label="Dates"
          value={formatStay(lead.tentativeDateFrom, lead.tentativeDateTo)}
          isData
        />
        <LeadFactRow label="Destination" value={lead.destinationText} />
        <LeadFactRow label="Guests" value={guests(lead.guestEstimate)} isData />
        <LeadFactRow label="Source" value={lead.source.name} />
        <LeadFactRow label="Owner" value={lead.ownerName ?? "Unassigned"} />
        <Divider />
        <LeadFactRow label="Email" value={lead.email} />
        <LeadFactRow label="Phone" value={lead.phone} isData />
        <LeadFactRow label="Marketing consent" value={lead.consentMarketing ? "Yes" : "No"} />
        <Divider />
        <LeadFactRow label="Requirements" value={lead.requirements} layout="stacked" />
      </Stack>
    </Card>
  );
}
