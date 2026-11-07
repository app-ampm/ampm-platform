import type { LeadView } from "@ampm/core";
import { StatusChip } from "@ampm/ui";

/** True when a lead carries a flag Sales acts on (a demo request, a possible duplicate). */
export function hasLeadFlags(lead: LeadView): boolean {
  return lead.requestedDemo || lead.duplicateOfLeadId !== null;
}

/**
 * A lead's flags as small chips, each a word: "Demo requested" (a highlight) and "Possible duplicate"
 * (waiting on a merge). The caller lays them out: a wrapping row on a board card, a column in a row.
 *
 *   {hasLeadFlags(lead) ? <Row wrap gap={1.5}><LeadFlagChips lead={lead} /></Row> : null}
 */
export function LeadFlagChips({ lead }: { readonly lead: LeadView }) {
  return (
    <>
      {lead.requestedDemo ? <StatusChip label="Demo requested" tone="brand" size="sm" /> : null}
      {lead.duplicateOfLeadId ? (
        <StatusChip label="Possible duplicate" tone="warning" size="sm" />
      ) : null}
    </>
  );
}
