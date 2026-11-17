import { useAccountContactInviteLink } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Row, Stack, Text, useToast } from "@ampm/ui";

import { env } from "@/lib/env";

import { copyText } from "./copy-text";

/**
 * Only a build on the local identity provider asks: the API serves invite links on test builds alone (a
 * 404 elsewhere), because only those have no real email provider to deliver the invite.
 */
export const SERVES_INVITE_LINKS = env.EXPO_PUBLIC_IDENTITY_PROVIDER === "local";

function CopyButton({ url }: { readonly url: string }) {
  const toast = useToast();
  if (!copyText) return null;
  const copy = copyText;
  const onCopy = async (): Promise<void> => {
    const copied = await copy(url);
    toast.show({
      title: copied ? "Invite link copied" : "Could not copy: select the link and copy it",
      tone: copied ? "success" : "warning",
    });
  };
  return (
    <Button variant="secondary" size="sm" icon="copy" onPress={onCopy} testID="contact-copy-link">
      Copy link
    </Button>
  );
}

export interface DevInviteLinkProps {
  readonly accountId: string;
  readonly contactId: string;
}

/**
 * A test build's stand-in for the invitation email, on a contact who has a portal login: Get invite link
 * shows a fresh activation link (selectable, and copyable on the web) for Sales to hand over. Each link
 * retires the one before it; a contact who already activated is told so by the API.
 *
 *   {SERVES_INVITE_LINKS ? <DevInviteLink accountId={accountId} contactId={contact.id} /> : null}
 */
export function DevInviteLink({ accountId, contactId }: DevInviteLinkProps) {
  const toast = useToast();
  const link = useAccountContactInviteLink(accountId, contactId);
  const url = link.data?.activationUrl;
  const getLink = (): void => {
    if (link.isPending) return;
    link.mutate(undefined, {
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not get the invite link",
          tone: "danger",
        }),
    });
  };
  return (
    <Stack gap={2} testID="contact-invite-link">
      <Text variant="label" tone="muted">
        Test build: invite link
      </Text>
      <Text variant="bodySmall" tone="muted">
        This build sends no email. Hand the client this link and open it in a private window: here
        it would sign you out. Each new link retires the last.
      </Text>
      {url ? (
        <Text variant="bodySmall" selectable testID="contact-invite-link-url">
          {url}
        </Text>
      ) : null}
      <Row gap={2} wrap>
        <Button
          variant="secondary"
          size="sm"
          icon="key"
          loading={link.isPending}
          onPress={getLink}
          testID="contact-get-invite-link"
        >
          {url ? "Get a new link" : "Get invite link"}
        </Button>
        {url ? <CopyButton url={url} /> : null}
      </Row>
    </Stack>
  );
}
