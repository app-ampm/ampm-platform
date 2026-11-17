import { useState } from "react";

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

/** The contact's latest link, kept while a new one loads or after a refusal (which retires nothing). */
function useDevInviteLink(accountId: string, contactId: string) {
  const toast = useToast();
  const link = useAccountContactInviteLink(accountId, contactId);
  const [url, setUrl] = useState<string | null>(null);
  const getLink = (): void => {
    if (link.isPending) return;
    link.mutate(undefined, {
      onSuccess: (result) => setUrl(result.activationUrl),
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not get the invite link",
          tone: "danger",
        }),
    });
  };
  return { url, getLink, pending: link.isPending };
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
  const { url, getLink, pending } = useDevInviteLink(accountId, contactId);
  return (
    <Stack gap={2} testID="contact-invite-link">
      <Text variant="label" tone="muted">
        Test build: invite link
      </Text>
      <Text variant="bodySmall" tone="muted">
        This build sends no email. Until they activate, get their link here and hand it over. Open
        it in a private window: here it would sign you out. Each new link retires the last.
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
          loading={pending}
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
