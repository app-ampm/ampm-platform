import { useConvertLead } from "@ampm/api-client";
import { isAppError, type LeadView } from "@ampm/core";
import { Button, Callout, Card, Stack, Text, useToast } from "@ampm/ui";

interface ConvertProps {
  readonly leadId: string;
  readonly email: string;
}

/**
 * The screen's one gold action: convert creates the client account and queues the portal invite to
 * the lead's email; the toast says whether the invite went or is pending, or why convert failed.
 */
function ConvertAction({ leadId, email }: ConvertProps) {
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
            title:
              isAppError(error) && error.code === "conflict"
                ? "This lead was already converted"
                : "Could not convert the lead",
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
    </Stack>
  );
}

/** Convert when it can happen; otherwise why not (already converted, closed, no email to invite). */
function InviteBody({ lead }: { readonly lead: LeadView }) {
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
    return <Callout kind="warning" title="Add an email before converting this lead" blur={false} />;
  }
  return <ConvertAction leadId={lead.id} email={lead.email} />;
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
