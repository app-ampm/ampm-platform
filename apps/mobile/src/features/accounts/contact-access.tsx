import { useInviteAccountContact } from "@ampm/api-client";
import { isAppError, type AccountContactView } from "@ampm/core";
import { Button, Row, Stack, Text, useToast } from "@ampm/ui";

import { DevInviteLink, SERVES_INVITE_LINKS } from "./dev-invite-link";
import type { AccountPermissions } from "./use-account-permissions";

/** Invite an existing contact to the portal; the sheet closes once the login exists. */
function useInvite(accountId: string, contactId: string, onDone: () => void) {
  const toast = useToast();
  const invite = useInviteAccountContact(accountId, contactId);
  const send = (): void => {
    if (invite.isPending) return;
    invite.mutate(undefined, {
      onSuccess: (result) => {
        toast.show({
          title: result.inviteQueued
            ? "Portal invite sent"
            : "Portal login created. The invite was not sent; try again later.",
          tone: result.inviteQueued ? "success" : "warning",
        });
        onDone();
      },
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not send the invite",
          tone: "danger",
        }),
    });
  };
  return { send, pending: invite.isPending };
}

/** Send portal invite and Remove contact, each only for a role that may. */
function AccessButtons({
  canInvite,
  canRemove,
  invitePending,
  onInvite,
  onRemove,
}: {
  readonly canInvite: boolean;
  readonly canRemove: boolean;
  readonly invitePending: boolean;
  readonly onInvite: () => void;
  readonly onRemove: () => void;
}) {
  if (!canInvite && !canRemove) return null;
  return (
    <Row gap={2} wrap>
      {canInvite ? (
        <Button
          variant="secondary"
          size="sm"
          icon="send"
          loading={invitePending}
          onPress={onInvite}
          testID="contact-send-invite"
        >
          Send portal invite
        </Button>
      ) : null}
      {canRemove ? (
        <Button variant="destructive" size="sm" onPress={onRemove} testID="contact-remove">
          Remove contact
        </Button>
      ) : null}
    </Row>
  );
}

/** A contact with a portal login stays; a test build also offers their invite link to hand over. */
function HasLogin({
  accountId,
  contactId,
  canGetLink,
}: {
  readonly accountId: string;
  readonly contactId: string;
  readonly canGetLink: boolean;
}) {
  return (
    <Stack gap={4}>
      <Text variant="bodySmall" tone="muted" testID="contact-has-login">
        Has portal access. A contact who signs in cannot be removed here.
      </Text>
      {canGetLink ? <DevInviteLink accountId={accountId} contactId={contactId} /> : null}
    </Stack>
  );
}

export interface ContactAccessProps {
  readonly accountId: string;
  readonly contact: AccountContactView;
  readonly permissions: AccountPermissions;
  /** Closes the sheet after an invite. */
  readonly onDone: () => void;
  readonly onRemove: () => void;
}

/**
 * A contact's portal access in the edit sheet. With a login: says so (they sign in, so they stay), and
 * on a test build, which sends no email, offers the invite link to hand over. Without: Send portal
 * invite (the saved email; a contact with none is asked for one first) and Remove contact, each for a
 * role that may.
 */
export function ContactAccess({
  accountId,
  contact,
  permissions,
  onDone,
  onRemove,
}: ContactAccessProps) {
  const invite = useInvite(accountId, contact.id, onDone);
  if (contact.userId !== null) {
    return (
      <HasLogin
        accountId={accountId}
        contactId={contact.id}
        canGetLink={SERVES_INVITE_LINKS && permissions.canAddContact}
      />
    );
  }
  const canInvite = permissions.canAddContact && contact.email !== null;
  return (
    <Stack gap={2} testID="contact-access">
      <Text variant="label" tone="muted">
        Portal access
      </Text>
      {permissions.canAddContact && contact.email === null ? (
        <Text variant="bodySmall" tone="muted">
          Save an email to invite them to the portal.
        </Text>
      ) : null}
      <AccessButtons
        canInvite={canInvite}
        canRemove={permissions.canRemoveContact}
        invitePending={invite.pending}
        onInvite={invite.send}
        onRemove={onRemove}
      />
    </Stack>
  );
}
