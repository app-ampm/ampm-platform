import { useAssignLeadOwner, useMe, useUpdateLead } from "@ampm/api-client";
import { isAppError, type LeadView } from "@ampm/core";
import { Button, Card, Row, Stack, Text, useToast } from "@ampm/ui";

import { isOpenLead, nextLeadStatus, statusLabel } from "./sales.format";

type ShowToast = ReturnType<typeof useToast>["show"];

function errorToast(show: ShowToast, verb: string) {
  return (error: Error): void => {
    show({ title: isAppError(error) ? error.message : `Could not ${verb}`, tone: "danger" });
  };
}

/** The advance + assign mutations and their toasts for the manage card. */
function useLeadManage(lead: LeadView) {
  const toast = useToast();
  const update = useUpdateLead(lead.id);
  const assign = useAssignLeadOwner(lead.id);
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
  return { next, advance, setOwner, advancing: update.isPending, assigning: assign.isPending };
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

/**
 * The working actions on an open lead (`crm.leads.update`): advance it one funnel stage and claim or
 * release its ownership. Both are non-destructive and reversible, so neither confirms. A terminal
 * (converted or closed) lead is read-only, so the card hides; the server is the real gate.
 *
 *   <LeadManageCard lead={lead} />
 */
export function LeadManageCard({ lead }: { readonly lead: LeadView }) {
  const me = useMe();
  const { next, advance, setOwner, advancing, assigning } = useLeadManage(lead);
  if (!isOpenLead(lead.status)) return null;
  const myUserId = me.data?.principal.userId;
  const owned = myUserId !== undefined && lead.ownerUserId === myUserId;
  // A lead past `new` must have an owner (OWNED_STATUSES): the server refuses an advance into an owned
  // stage while the lead is unassigned, so Advance only shows once the lead has an owner — assign first.
  const hasOwner = lead.ownerUserId !== null;
  return (
    <Card testID="lead-manage">
      <Stack gap={4}>
        <Text variant="subheading">Manage</Text>
        <Stack gap={1}>
          <Text variant="label" tone="muted">
            Owner
          </Text>
          <Text variant="body">{lead.ownerName ?? "Unassigned"}</Text>
        </Stack>
        <Row gap={2} wrap>
          {next && hasOwner ? (
            <Button variant="highlight" loading={advancing} onPress={advance} testID="lead-advance">
              {`Advance to ${statusLabel(next)}`}
            </Button>
          ) : null}
          <OwnerButton owned={owned} myUserId={myUserId} pending={assigning} onAssign={setOwner} />
        </Row>
        {next && !hasOwner ? (
          <Text variant="bodySmall" tone="muted" testID="lead-advance-needs-owner">
            Assign an owner to advance this lead.
          </Text>
        ) : null}
      </Stack>
    </Card>
  );
}
