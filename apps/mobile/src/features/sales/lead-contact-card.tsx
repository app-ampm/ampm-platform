import type { LeadView } from "@ampm/core";
import { Card, Divider, Stack, Text } from "@ampm/ui";

import { LeadFactRow } from "./lead-fact-row";

/**
 * How to reach a lead and what they asked for, on glass (T3's side column): the facts that do not fit
 * the record header's line (where, when, guests, source and owner live there).
 *
 *   <LeadContactCard lead={lead} />
 */
export function LeadContactCard({ lead }: { readonly lead: LeadView }) {
  return (
    <Card className="md:p-6" testID="lead-contact">
      <Stack gap={3}>
        <Text variant="subheading">Contact</Text>
        <LeadFactRow label="Email" value={lead.email} />
        <LeadFactRow label="Phone" value={lead.phone} isData />
        <LeadFactRow label="Marketing consent" value={lead.consentMarketing ? "Yes" : "No"} />
        <Divider />
        <LeadFactRow label="Requirements" value={lead.requirements} layout="stacked" />
      </Stack>
    </Card>
  );
}
