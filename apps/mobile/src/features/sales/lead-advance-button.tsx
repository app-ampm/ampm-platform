import { useUpdateLead } from "@ampm/api-client";
import { isAppError, type LeadView } from "@ampm/core";
import { Button, useToast } from "@ampm/ui";

import { nextLeadStatus, statusLabel } from "./sales.format";

/**
 * Moves an owned, open lead one funnel stage (`crm.leads.update`): a record-header action on T3, glass
 * because the invitation's send button is the page's one gold action. Reversible, so it does not confirm.
 * Hidden where there is no linear next stage, and until someone owns the lead: the server refuses a move
 * past `new` without an owner, and the manage card says so.
 *
 *   <LeadAdvanceButton lead={lead} />
 */
export function LeadAdvanceButton({ lead }: { readonly lead: LeadView }) {
  const toast = useToast();
  const update = useUpdateLead(lead.id);
  const next = nextLeadStatus(lead.status);
  if (!next || lead.ownerUserId === null) return null;
  const advance = (): void => {
    if (update.isPending) return;
    update.mutate(
      { status: next },
      {
        onSuccess: () => toast.show({ title: `Moved to ${statusLabel(next)}`, tone: "success" }),
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : "Could not move the lead",
            tone: "danger",
          }),
      },
    );
  };
  return (
    <Button
      variant="glass"
      icon="arrow-right"
      loading={update.isPending}
      onPress={advance}
      testID="lead-advance"
    >
      {`Advance to ${statusLabel(next)}`}
    </Button>
  );
}
