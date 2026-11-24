import { Sheet, Text } from "@ampm/ui";

import { RecordShareForm } from "./record-share-form";

export interface RecordShareSheetProps {
  readonly open: boolean;
  readonly requestId: string;
  readonly reference: string;
  readonly onClose: () => void;
}

/**
 * Record share, from the request panel (D-188 §3 and §7): how staff passed the link on by hand since it
 * was issued, WhatsApp, a copy or another way, with a note for AMPM. The link is never sent.
 *
 *   <RecordShareSheet open={action === "share"} requestId={id} reference={ref} onClose={close} />
 */
export function RecordShareSheet({ open, requestId, reference, onClose }: RecordShareSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Record a share of ${reference}`}
      testID="record-share"
    >
      <Text variant="bodySmall" tone="body">
        Say how the link reached the hotel, so the team knows who has it.
      </Text>
      {open ? (
        <RecordShareForm requestId={requestId} onRecorded={onClose} testID="record-share-form" />
      ) : null}
    </Sheet>
  );
}
