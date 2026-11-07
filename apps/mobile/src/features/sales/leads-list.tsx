import type { LeadView } from "@ampm/core";
import { Card, ListItem, Stack, StatusChip } from "@ampm/ui";

import { LeadFlagChips } from "./lead-flag-chips";
import { formatStay, leadSummary, statusLabel, statusTone } from "./sales.format";

export interface LeadsListProps {
  /** The loaded leads, newest first. */
  readonly leads: readonly LeadView[];
  readonly onOpen: (leadId: string) => void;
}

/** The stay and the source as one data line: "12–14 FEB 2027 · Website". */
function rowMeta(lead: LeadView): string {
  return [formatStay(lead.tentativeDateFrom, lead.tentativeDateTo), lead.source.name]
    .filter(Boolean)
    .join(" · ");
}

/** The stage as a chip, the flags under it. */
function RowChips({ lead }: { readonly lead: LeadView }) {
  return (
    <Stack gap={1} align="end">
      <StatusChip label={statusLabel(lead.status)} tone={statusTone(lead.status)} size="sm" />
      <LeadFlagChips lead={lead} />
    </Stack>
  );
}

/**
 * The pipeline on a phone: one glass panel of lead rows, newest first, each with its contact, stay
 * and source, and its stage as a chip. Each row opens the lead.
 *
 *   <LeadsList leads={page.items} onOpen={openLead} />
 */
export function LeadsList({ leads, onOpen }: LeadsListProps) {
  return (
    <Card padding="sm" testID="leads-list">
      <Stack gap={2}>
        {leads.map((lead) => (
          <ListItem
            key={lead.id}
            title={lead.name}
            subtitle={lead.email ?? lead.phone ?? "No contact"}
            meta={rowMeta(lead)}
            trailing={<RowChips lead={lead} />}
            onPress={() => onOpen(lead.id)}
            accessibilityLabel={`Lead from ${lead.name}: ${leadSummary(lead)}`}
            testID={`lead-row-${lead.id}`}
          />
        ))}
      </Stack>
    </Card>
  );
}
