import { useState } from "react";

import { isLiveHotelInfoRequestStatus, type HotelInfoRequestFullView } from "@ampm/core";
import { Button, Row, type IconName } from "@ampm/ui";

import { EditRequestSheet } from "./edit-request-sheet";
import { ExtendSheet } from "./extend-sheet";
import { RecordShareSheet } from "./record-share-sheet";
import { ReissueSheet } from "./reissue-sheet";
import { RevokeRequestConfirm } from "./revoke-request-confirm";

/** An action a live request takes; each opens its own sheet. */
type Action = "reissue" | "extend" | "share" | "edit" | "revoke";

/**
 * Which actions a request takes: each only where the API would accept it.
 *
 * @example
 * requestActionsFor(expired).reissue; // false: an expired link is extended first
 */
export function requestActionsFor(request: HotelInfoRequestFullView): Record<Action, boolean> {
  const live = isLiveHotelInfoRequestStatus(request.status);
  const roomToExtend =
    request.extendableUntil !== null &&
    new Date(request.extendableUntil).getTime() > new Date(request.expiresAt).getTime();
  return {
    // A reissue keeps the expiry, so an expired link is extended first.
    reissue: live && !request.isExpired,
    extend: live && roomToExtend,
    share: live,
    edit: live,
    revoke: request.status === "open" || request.status === "changes_requested",
  };
}

const BUTTONS: readonly {
  readonly action: Exclude<Action, "revoke">;
  readonly label: string;
  readonly icon: IconName;
}[] = [
  { action: "reissue", label: "Reissue link", icon: "refresh" },
  { action: "extend", label: "Extend", icon: "calendar" },
  { action: "share", label: "Record share", icon: "share" },
  { action: "edit", label: "Edit", icon: "edit" },
];

/** The buttons the request's state allows; Revoke in the gold outline, never red. */
function ActionButtons({
  allowed,
  onOpen,
}: {
  readonly allowed: Record<Action, boolean>;
  readonly onOpen: (action: Action) => void;
}) {
  return (
    <Row gap={2} wrap testID="request-actions">
      {BUTTONS.filter(({ action }) => allowed[action]).map(({ action, label, icon }) => (
        <Button
          key={action}
          variant="secondary"
          size="sm"
          icon={icon}
          onPress={() => onOpen(action)}
          testID={`request-${action}`}
        >
          {label}
        </Button>
      ))}
      {allowed.revoke ? (
        <Button
          variant="destructive"
          size="sm"
          icon="x-circle"
          onPress={() => onOpen("revoke")}
          testID="request-revoke"
        >
          Revoke
        </Button>
      ) : null}
    </Row>
  );
}

export interface RequestActionsProps {
  /** The request in the full view: only a holder of `hotels.info_requests.update` gets it. */
  readonly request: HotelInfoRequestFullView;
}

/**
 * A live request's actions (D-188 §7), for a holder of the update key: Reissue (while the link has not
 * expired), Extend (while the policy leaves room), Record share, Edit and, for an open or
 * changes-requested request, Revoke in the gold outline. Each opens its sheet; the sheets stay mounted
 * so a refresh of the request never cuts one off mid-step.
 *
 *   {canUpdate && "events" in request ? <RequestActions request={request} /> : null}
 */
export function RequestActions({ request }: RequestActionsProps) {
  const [action, setAction] = useState<Action | null>(null);
  const close = (): void => setAction(null);
  return (
    <>
      <ActionButtons allowed={requestActionsFor(request)} onOpen={setAction} />
      <ReissueSheet open={action === "reissue"} request={request} onClose={close} />
      <ExtendSheet open={action === "extend"} request={request} onClose={close} />
      <RecordShareSheet
        open={action === "share"}
        requestId={request.id}
        reference={request.reference}
        onClose={close}
      />
      <EditRequestSheet open={action === "edit"} request={request} onClose={close} />
      <RevokeRequestConfirm open={action === "revoke"} request={request} onClose={close} />
    </>
  );
}
