import { useState } from "react";

import { useRevokeHotelInfoRequest } from "@ampm/api-client";
import type { HotelInfoRequestFullView } from "@ampm/core";
import { ConfirmSheet, Input, useToast } from "@ampm/ui";

import { revokeReasonError } from "./info-request.form";
import { refusalOf } from "./info-request.refusal";

/** The revoke's state: the reason, blank each time the confirm opens, and why it cannot go yet. */
function useRevoke(open: boolean, request: HotelInfoRequestFullView, onClose: () => void) {
  const toast = useToast();
  const revoke = useRevokeHotelInfoRequest();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | undefined>(undefined);
  const [seededOpen, setSeededOpen] = useState(open);
  if (open !== seededOpen) {
    setSeededOpen(open);
    if (open) {
      setReason("");
      setError(undefined);
    }
  }
  const onSuccess = (): void => {
    toast.show({ title: `${request.reference} revoked`, tone: "success" });
    onClose();
  };
  const onError = (refused: unknown): void => {
    const { message } = refusalOf(refused, "Could not revoke the request");
    setError(message);
    toast.show({ title: message, tone: "danger" });
  };
  const confirm = (): void => {
    if (revoke.isPending) return;
    const missing = revokeReasonError(reason);
    if (missing) return setError(missing);
    revoke.mutate(
      { requestId: request.id, body: { reason: reason.trim() } },
      { onSuccess, onError },
    );
  };
  const change = (next: string): void => {
    setReason(next);
    setError(undefined);
  };
  return { reason, change, error, confirm, pending: revoke.isPending };
}

export interface RevokeRequestConfirmProps {
  readonly open: boolean;
  readonly request: HotelInfoRequestFullView;
  readonly onClose: () => void;
}

/**
 * Revoke an open or changes-requested request (D-188 §2 and §7), with the reason the record keeps: a
 * ConfirmSheet, the gold outline (never red), because the link stops working at once for everyone who
 * has it and cannot be brought back. A refusal shows the API's message under the reason.
 *
 *   <RevokeRequestConfirm open={action === "revoke"} request={request} onClose={close} />
 */
export function RevokeRequestConfirm({ open, request, onClose }: RevokeRequestConfirmProps) {
  const state = useRevoke(open, request, onClose);
  return (
    <ConfirmSheet
      open={open}
      onClose={onClose}
      title={`Revoke ${request.reference}?`}
      description="Its link stops working at once, for everyone who has it. This cannot be undone: a new request starts again."
      confirmLabel="Revoke request"
      destructive
      loading={state.pending}
      onConfirm={state.confirm}
      testID="revoke-request"
    >
      <Input
        label="Reason"
        required
        helpText="Kept on the request's record."
        value={state.reason}
        onChangeText={state.change}
        errorText={state.error}
        multiline
        testID="revoke-request-reason"
      />
    </ConfirmSheet>
  );
}
