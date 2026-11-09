import { useEffect, useState } from "react";

import { useUpdateLead } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Input, Sheet, Stack, useToast } from "@ampm/ui";

/** The close-lead form: a required reason, then `PATCH {status:"closed", closedReason}` via useUpdateLead. */
function useCloseLeadForm(leadId: string, open: boolean, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateLead(leadId);
  const [reason, setReason] = useState("");
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    if (open) {
      setReason("");
      setShowError(false);
    }
  }, [open]);
  const trimmed = reason.trim();
  const submit = (): void => {
    if (update.isPending) return;
    if (trimmed.length === 0) return setShowError(true);
    update.mutate(
      { status: "closed", closedReason: trimmed },
      {
        onSuccess: () => {
          toast.show({ title: "Lead closed", tone: "success" });
          onClose();
        },
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : "Could not close the lead",
            tone: "danger",
          }),
      },
    );
  };
  return {
    reason,
    setReason,
    reasonError:
      showError && trimmed.length === 0 ? "Give a reason for closing this lead" : undefined,
    pending: update.isPending,
    submit,
  };
}

export interface LeadCloseSheetProps {
  /** The lead to close, or null when the sheet is closed. */
  readonly leadId: string | null;
  readonly onClose: () => void;
}

/**
 * Close a lead with a reason (Sales, `crm.leads.update`): a terminal move, so it takes a reason and the
 * card confirms it. The reason is required here (a closed lead should say why); the server keeps it on the
 * lead. On success the lead becomes read-only and the manage card hides.
 */
export function LeadCloseSheet({ leadId, onClose }: LeadCloseSheetProps) {
  const { reason, setReason, reasonError, pending, submit } = useCloseLeadForm(
    leadId ?? "",
    leadId !== null,
    onClose,
  );
  return (
    <Sheet
      open={leadId !== null}
      onClose={onClose}
      title="Close lead"
      testID="lead-close-sheet"
      footer={
        <Button
          fullWidth
          variant="destructive"
          loading={pending}
          onPress={submit}
          testID="lead-close-submit"
        >
          Close lead
        </Button>
      }
    >
      <Stack gap={4}>
        <Input
          label="Reason"
          required
          value={reason}
          onChangeText={setReason}
          placeholder="Why is this lead closing? (not responsive, chose another planner, …)"
          errorText={reasonError}
          multiline
          testID="lead-close-reason"
        />
      </Stack>
    </Sheet>
  );
}
