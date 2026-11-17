import { useState } from "react";

import { useConvertLead } from "@ampm/api-client";
import { isAppError, type LeadView } from "@ampm/core";
import { Button, Callout, Card, Stack, Text, useToast } from "@ampm/ui";

import { LeadInviteEmail } from "./lead-invite-email";
import { useCanUpdateLead } from "./use-can-update-lead";

interface ConvertProps {
  readonly leadId: string;
  readonly email: string;
  /** Opens the email correction; absent for a role that cannot edit the lead. */
  readonly onChangeEmail?: (() => void) | undefined;
}

// A 409 is either a lead someone converted first or an email that already belongs to an AMPM user
// (the API refuses both), so the message names both rather than guess.
const CONFLICT_REASON = "It was converted already, or this email already has an AMPM account.";

/**
 * The screen's one gold action: convert creates the client account and queues the portal invite to
 * the lead's email; the toast says whether the invite went or is pending, or why convert failed.
 */
function ConvertAction({ leadId, email, onChangeEmail }: ConvertProps) {
  const toast = useToast();
  const convert = useConvertLead(leadId);
  const onConvert = (): void =>
    convert.mutate(
      { primaryContact: { email, isDecisionMaker: true } },
      {
        onSuccess: (result) =>
          toast.show({
            title: result.inviteQueued ? "Converted — invite sent" : "Converted — invite pending",
            tone: "success",
          }),
        onError: (error) =>
          toast.show({
            title: "Could not convert the lead",
            description:
              isAppError(error) && error.code === "conflict" ? CONFLICT_REASON : undefined,
            tone: "danger",
          }),
      },
    );
  return (
    <Stack gap={3.5}>
      <Text variant="bodySmall">{`Creates the client account and invites ${email} to the client portal.`}</Text>
      <Button fullWidth loading={convert.isPending} onPress={onConvert}>
        Create account and invite
      </Button>
      {onChangeEmail ? (
        <Button variant="secondary" fullWidth disabled={convert.isPending} onPress={onChangeEmail}>
          Change email
        </Button>
      ) : null}
    </Stack>
  );
}

/**
 * Convert when it can happen; otherwise why not (already converted, closed). Without an email the lead
 * cannot be invited, so an editor adds one here; an editor can also correct it before converting.
 */
function InviteBody({ lead }: { readonly lead: LeadView }) {
  const canUpdateLead = useCanUpdateLead();
  const [isEditingEmail, setEditingEmail] = useState(false);
  if (lead.convertedAccountId) {
    return <Callout kind="success" title="Converted to a client account" blur={false} />;
  }
  if (lead.status === "converted" || lead.status === "closed") {
    return (
      <Callout kind="info" title={`This lead is ${lead.status}`} blur={false}>
        {lead.closedReason ?? undefined}
      </Callout>
    );
  }
  if (!lead.email) {
    return canUpdateLead ? (
      <LeadInviteEmail leadId={lead.id} />
    ) : (
      <Callout kind="warning" title="Add an email before converting this lead" blur={false}>
        Sales adds the couple's email here.
      </Callout>
    );
  }
  if (isEditingEmail) {
    const done = (): void => setEditingEmail(false);
    return <LeadInviteEmail leadId={lead.id} currentEmail={lead.email} onDone={done} />;
  }
  const changeEmail = canUpdateLead ? () => setEditingEmail(true) : undefined;
  return <ConvertAction leadId={lead.id} email={lead.email} onChangeEmail={changeEmail} />;
}

/**
 * The invitation panel of T3: turns the lead into a client account and invites its contact to the
 * portal, where hotel discovery opens. Nested notices pass `blur={false}`: only this card blurs.
 *
 *   <LeadInviteCard lead={lead} />
 */
export function LeadInviteCard({ lead }: { readonly lead: LeadView }) {
  return (
    <Card className="md:p-6" testID="lead-invite">
      <Stack gap={3.5}>
        <Text variant="subheading">Invite to hotel discovery</Text>
        <InviteBody lead={lead} />
      </Stack>
    </Card>
  );
}
