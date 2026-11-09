import { useState } from "react";

import { useAssignLeadOwner, useMe, useMergeLead, useUpdateLead } from "@ampm/api-client";
import { isAppError, type LeadView } from "@ampm/core";
import { Button, Card, ConfirmSheet, Row, Stack, Text, useToast } from "@ampm/ui";

import { LeadCloseSheet } from "./lead-close-sheet";
import { isOpenLead, nextLeadStatus, statusLabel } from "./sales.format";

type ShowToast = ReturnType<typeof useToast>["show"];

function errorToast(show: ShowToast, verb: string) {
  return (error: Error): void => {
    show({ title: isAppError(error) ? error.message : `Could not ${verb}`, tone: "danger" });
  };
}

/** The advance, assign and merge mutations and their toasts for the manage card. */
function useLeadManage(lead: LeadView) {
  const toast = useToast();
  const update = useUpdateLead(lead.id);
  const assign = useAssignLeadOwner(lead.id);
  const merge = useMergeLead(lead.id);
  const next = nextLeadStatus(lead.status);
  const advance = (): void => {
    if (!next || update.isPending) return;
    update.mutate(
      { status: next },
      {
        onSuccess: () => toast.show({ title: `Moved to ${statusLabel(next)}`, tone: "success" }),
        onError: errorToast(toast.show, "move the lead"),
      },
    );
  };
  const setOwner = (ownerUserId: string | null): void => {
    if (assign.isPending) return;
    assign.mutate(
      { ownerUserId },
      {
        onSuccess: () =>
          toast.show({ title: ownerUserId ? "Assigned to you" : "Owner cleared", tone: "success" }),
        onError: errorToast(toast.show, "change the owner"),
      },
    );
  };
  const confirmMerge = (onDone: () => void): void => {
    if (merge.isPending || !lead.duplicateOfLeadId) return;
    merge.mutate(
      { survivorLeadId: lead.duplicateOfLeadId },
      {
        onSuccess: () => {
          toast.show({ title: "Lead merged into the original", tone: "success" });
          onDone();
        },
        onError: errorToast(toast.show, "merge the lead"),
      },
    );
  };
  return {
    next,
    advance,
    setOwner,
    confirmMerge,
    advancing: update.isPending,
    assigning: assign.isPending,
    merging: merge.isPending,
  };
}

/** Claim or release the lead: Unassign when you own it, Assign to me otherwise (needs the signed-in id). */
function OwnerButton({
  owned,
  myUserId,
  pending,
  onAssign,
}: {
  readonly owned: boolean;
  readonly myUserId: string | undefined;
  readonly pending: boolean;
  readonly onAssign: (ownerUserId: string | null) => void;
}) {
  if (owned) {
    return (
      <Button
        variant="secondary"
        loading={pending}
        onPress={() => onAssign(null)}
        testID="lead-unassign"
      >
        Unassign
      </Button>
    );
  }
  if (myUserId === undefined) return null;
  return (
    <Button
      variant="secondary"
      loading={pending}
      onPress={() => onAssign(myUserId)}
      testID="lead-assign-me"
    >
      Assign to me
    </Button>
  );
}

interface ActionsProps {
  readonly lead: LeadView;
  readonly next: LeadView["status"] | null;
  readonly hasOwner: boolean;
  readonly owned: boolean;
  readonly myUserId: string | undefined;
  readonly advancing: boolean;
  readonly assigning: boolean;
  readonly advance: () => void;
  readonly setOwner: (ownerUserId: string | null) => void;
  readonly onClose: () => void;
  readonly onMerge: () => void;
}

/** The lead's action buttons: advance (owned only), claim/release, merge a duplicate, and close. */
function ManageActions(props: ActionsProps) {
  const { lead, next, hasOwner, owned, myUserId, advancing, assigning } = props;
  return (
    <Row gap={2} wrap>
      {next && hasOwner ? (
        <Button
          variant="highlight"
          loading={advancing}
          onPress={props.advance}
          testID="lead-advance"
        >
          {`Advance to ${statusLabel(next)}`}
        </Button>
      ) : null}
      <OwnerButton
        owned={owned}
        myUserId={myUserId}
        pending={assigning}
        onAssign={props.setOwner}
      />
      {lead.duplicateOfLeadId ? (
        <Button variant="secondary" onPress={props.onMerge} testID="lead-merge">
          Merge duplicate
        </Button>
      ) : null}
      <Button variant="destructive" onPress={props.onClose} testID="lead-close">
        Close lead
      </Button>
    </Row>
  );
}

/**
 * The working actions on an open lead (`crm.leads.update`): advance it one funnel stage, claim or release
 * its ownership, merge a flagged duplicate into the original, and close it with a reason. Advance and
 * assign are reversible so neither confirms; close and merge are terminal, so each confirms first. A
 * terminal (converted or closed) lead is read-only, so the card hides; the server is the real gate.
 *
 *   <LeadManageCard lead={lead} />
 */
export function LeadManageCard({ lead }: { readonly lead: LeadView }) {
  const me = useMe();
  const { next, advance, setOwner, confirmMerge, advancing, assigning, merging } =
    useLeadManage(lead);
  const [closeOpen, setCloseOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  if (!isOpenLead(lead.status)) return null;
  const myUserId = me.data?.principal.userId;
  const owned = myUserId !== undefined && lead.ownerUserId === myUserId;
  const hasOwner = lead.ownerUserId !== null;
  return (
    <>
      <Card testID="lead-manage">
        <Stack gap={4}>
          <Text variant="subheading">Manage</Text>
          <Stack gap={1}>
            <Text variant="label" tone="muted">
              Owner
            </Text>
            <Text variant="body">{lead.ownerName ?? "Unassigned"}</Text>
          </Stack>
          <ManageActions
            lead={lead}
            next={next}
            hasOwner={hasOwner}
            owned={owned}
            myUserId={myUserId}
            advancing={advancing}
            assigning={assigning}
            advance={advance}
            setOwner={setOwner}
            onClose={() => setCloseOpen(true)}
            onMerge={() => setMergeOpen(true)}
          />
          {next && !hasOwner ? (
            <Text variant="bodySmall" tone="muted" testID="lead-advance-needs-owner">
              Assign an owner to advance this lead.
            </Text>
          ) : null}
        </Stack>
      </Card>
      <LeadCloseSheet leadId={closeOpen ? lead.id : null} onClose={() => setCloseOpen(false)} />
      <ConfirmSheet
        open={mergeOpen}
        onClose={() => setMergeOpen(false)}
        title="Merge this duplicate?"
        description="This lead's activity moves to the original and this lead closes. A merge can't be undone."
        confirmLabel="Merge lead"
        destructive
        loading={merging}
        onConfirm={() => confirmMerge(() => setMergeOpen(false))}
        testID="lead-merge-confirm"
      />
    </>
  );
}
