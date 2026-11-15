import { useState } from "react";

import { useTransitionServiceAgreement } from "@ampm/api-client";
import { formatDay, type ServiceAgreementStaffView, type ServiceAgreementStatus } from "@ampm/core";
import { Button, ConfirmSheet, Row, Stack, Text, useToast } from "@ampm/ui";

import { MarkSignedOfflineButton, ViewSignedCopyButton } from "./agreement-signed-copy";
import { errorMessage } from "./consultancy-admin.form";

type Agreement = ServiceAgreementStaffView;

/** The step forward staff take at each status; `sent` has none, because the client accepts it. */
const FORWARD: Partial<
  Record<ServiceAgreementStatus, { to: ServiceAgreementStatus; label: string }>
> = {
  draft: { to: "sent", label: "Send to client" },
  accepted: { to: "active", label: "Activate: start the work" },
  active: { to: "completed", label: "Mark completed" },
};

const OPEN: ReadonlySet<ServiceAgreementStatus> = new Set(["draft", "sent", "accepted", "active"]);

/**
 * Where an agreement stands, in words: who it waits on, who accepted it and how, what activating does.
 * Exported for the tests; the card draws it above the actions.
 */
export function agreementStanding(agreement: Agreement): string | null {
  const on = agreement.acceptedAt ? ` on ${formatDay(agreement.acceptedAt)}` : "";
  switch (agreement.status) {
    case "draft":
      return "Draft · the client has not seen it yet. Send it when the terms are right.";
    case "sent":
      return "Sent · waiting for the client to accept it in their portal.";
    case "accepted":
      return agreement.acceptedByUserId
        ? `Accepted by the client${on}. Activate it to start the paid work.`
        : `Signed outside the app, recorded${on}. Activate it to start the paid work.`;
    case "active":
      return "Active · the paid work can go ahead.";
    default:
      return null;
  }
}

/** Moves the agreement; a refused move says why (the API's words) and the list re-reads itself. */
function useMove(agreement: Agreement, enquiryId: string) {
  const toast = useToast();
  const transition = useTransitionServiceAgreement(agreement.id, enquiryId);
  const move = (status: ServiceAgreementStatus, onDone?: () => void): void =>
    transition.mutate(
      { status },
      {
        onSuccess: onDone,
        onError: (error) =>
          toast.show({
            title: errorMessage(error, "Could not move the agreement"),
            tone: "danger",
          }),
      },
    );
  return { move, pending: transition.isPending };
}

/**
 * What staff can do with an agreement, per the feature 10.2 design: send a draft; while it is sent, wait
 * for the client to accept in the portal, or mark it signed offline with its signed copy (staff never
 * accept it themselves); activate an accepted one, which starts the work and unlocks the chargeable
 * stages; complete an active one. Cancelling is final, so it asks first.
 */
export function AgreementActions({
  agreement,
  enquiryId,
}: {
  readonly agreement: Agreement;
  readonly enquiryId: string;
}) {
  const { move, pending } = useMove(agreement, enquiryId);
  const standing = agreementStanding(agreement);
  const forward = FORWARD[agreement.status];
  if (!OPEN.has(agreement.status) && !agreement.documentId) return null;
  return (
    <Stack gap={3}>
      {standing ? (
        <Text variant="bodySmall" tone="body" testID={`agreement-standing-${agreement.id}`}>
          {standing}
        </Text>
      ) : null}
      <Row gap={2} wrap>
        {forward ? (
          <Button variant="highlight" size="sm" loading={pending} onPress={() => move(forward.to)}>
            {forward.label}
          </Button>
        ) : null}
        {agreement.status === "sent" ? (
          <MarkSignedOfflineButton agreement={agreement} enquiryId={enquiryId} />
        ) : null}
        {agreement.documentId ? <ViewSignedCopyButton agreementId={agreement.id} /> : null}
        {OPEN.has(agreement.status) ? (
          <CancelAgreement
            name={agreement.serviceName}
            pending={pending}
            onCancel={(done) => move("cancelled", done)}
          />
        ) : null}
      </Row>
    </Stack>
  );
}

function CancelAgreement({
  name,
  pending,
  onCancel,
}: {
  readonly name: string;
  readonly pending: boolean;
  readonly onCancel: (done: () => void) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" disabled={pending} onPress={() => setOpen(true)}>
        Cancel agreement
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Cancel the ${name} agreement?`}
        description="A cancelled agreement cannot be reopened. Draft a new one if the client still wants the service."
        confirmLabel="Cancel agreement"
        cancelLabel="Keep it"
        destructive
        loading={pending}
        onConfirm={() => onCancel(() => setOpen(false))}
      />
    </>
  );
}
