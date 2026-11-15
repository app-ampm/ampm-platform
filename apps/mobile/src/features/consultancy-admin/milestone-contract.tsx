import { Linking } from "react-native";

import { useAttachMilestoneContract, useMilestoneContractLink } from "@ampm/api-client";
import {
  DOCUMENT_UPLOAD_TYPES,
  MAX_DOCUMENT_UPLOAD_BYTES,
  type BookingMilestoneStaffView,
  type BookingMilestoneStatus,
} from "@ampm/core";
import { Button, pickFile, Row, Text, useToast } from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";

const OPEN_STATUSES: ReadonlySet<BookingMilestoneStatus> = new Set(["pending", "overdue"]);
const LIMIT_MB = MAX_DOCUMENT_UPLOAD_BYTES / (1024 * 1024);

/**
 * The status moves a milestone offers, less "done" for a `contract_signed` milestone with no contract
 * yet: the API refuses it (D-132), and a done milestone is read-only, so the button would only lead to
 * an error. The contract control below says what unlocks it.
 */
export function milestoneNexts(
  milestone: BookingMilestoneStaffView,
  nexts: readonly BookingMilestoneStatus[],
): readonly BookingMilestoneStatus[] {
  const needsContract = milestone.milestoneType === "contract_signed" && !milestone.documentId;
  return needsContract ? nexts.filter((status) => status !== "done") : nexts;
}

/** Pick the signed contract and upload it; the size is checked here so a too-big file never uploads. */
function useAttach(milestone: BookingMilestoneStaffView, enquiryId: string) {
  const toast = useToast();
  const attach = useAttachMilestoneContract(milestone.id, enquiryId);
  const replacing = milestone.documentId !== null;
  const choose = async (): Promise<void> => {
    if (attach.isPending) return;
    const picked = await pickFile(DOCUMENT_UPLOAD_TYPES.join(","));
    if (!picked) {
      toast.show({ title: "Attach the contract from the web workspace", tone: "info" });
      return;
    }
    if (picked.sizeBytes > MAX_DOCUMENT_UPLOAD_BYTES) {
      toast.show({ title: `This file is over the ${LIMIT_MB} MB limit`, tone: "danger" });
      return;
    }
    attach.mutate(
      { file: picked.file },
      {
        onSuccess: () =>
          toast.show({
            title: replacing ? "Signed contract replaced" : "Signed contract attached",
            tone: "success",
          }),
        onError: (error) =>
          toast.show({
            title: errorMessage(error, "Could not attach the contract"),
            tone: "danger",
          }),
      },
    );
  };
  return { choose, pending: attach.isPending };
}

/** Mint a 15-minute link and open it; every press mints its own (a link is a recorded access). */
function useView(milestoneId: string) {
  const toast = useToast();
  const link = useMilestoneContractLink(milestoneId);
  const open = (): void => {
    if (link.isPending) return;
    link.mutate(undefined, {
      onSuccess: ({ url }) => void Linking.openURL(url),
      onError: (error) =>
        toast.show({ title: errorMessage(error, "Could not open the contract"), tone: "danger" }),
    });
  };
  return { open, pending: link.isPending };
}

/**
 * The signed contract on a `contract_signed` booking milestone (AC-05.6, D-132): the enquiry reaches
 * Confirmed only once this milestone is done with a contract attached. While the milestone is open staff
 * attach (or replace) the PDF or scan; once one is attached anyone who reads milestones can view it
 * through a short-lived link. Other milestone types render nothing.
 */
export function MilestoneContract({
  milestone,
  enquiryId,
}: {
  readonly milestone: BookingMilestoneStaffView;
  readonly enquiryId: string;
}) {
  const view = useView(milestone.id);
  if (milestone.milestoneType !== "contract_signed") return null;
  const isOpen = OPEN_STATUSES.has(milestone.status);
  const hasContract = milestone.documentId !== null;
  if (!isOpen && !hasContract) return null;
  return (
    <>
      {isOpen && !hasContract ? (
        <Text variant="bodySmall" tone="body">
          Attach the signed contract (PDF, JPEG or PNG) to mark this done.
        </Text>
      ) : null}
      <Row gap={2} wrap>
        {hasContract ? (
          <Button
            variant="secondary"
            size="sm"
            icon="file"
            loading={view.pending}
            onPress={view.open}
          >
            View contract
          </Button>
        ) : null}
        {isOpen ? <AttachButton milestone={milestone} enquiryId={enquiryId} /> : null}
      </Row>
    </>
  );
}

/** Attach the signed contract, or replace the one on file while the milestone is open. */
function AttachButton({
  milestone,
  enquiryId,
}: {
  readonly milestone: BookingMilestoneStaffView;
  readonly enquiryId: string;
}) {
  const attach = useAttach(milestone, enquiryId);
  const hasContract = milestone.documentId !== null;
  return (
    <Button
      variant={hasContract ? "ghost" : "highlight"}
      size="sm"
      icon="paperclip"
      loading={attach.pending}
      onPress={() => void attach.choose()}
    >
      {hasContract ? "Replace contract" : "Attach signed contract"}
    </Button>
  );
}
