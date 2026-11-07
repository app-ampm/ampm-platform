import { useState } from "react";

import { useInviteStaffUser } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import { Button, Input, Sheet, Stack, useToast } from "@ampm/ui";

/** A pragmatic check so the field catches an obvious typo; the server re-validates the address. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteDraft {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
}

const EMPTY_DRAFT: InviteDraft = { name: "", email: "", phone: "" };

export interface InviteStaffSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

function inviteErrorTitle(error: unknown): string {
  return isAppError(error) && error.code === "conflict"
    ? "A staff member with that email already exists"
    : "Could not send the invitation";
}

/** The invite form's state, validation and submission; kept out of the view so each stays small. */
function useInviteForm(onClose: () => void) {
  const toast = useToast();
  const invite = useInviteStaffUser();
  const [draft, setDraft] = useState<InviteDraft>(EMPTY_DRAFT);
  const [showErrors, setShowErrors] = useState(false);
  const name = draft.name.trim();
  const email = draft.email.trim();
  const close = (): void => {
    setDraft(EMPTY_DRAFT);
    setShowErrors(false);
    onClose();
  };
  const onSuccess = (user: { email: string }): void => {
    toast.show({ title: `Invitation sent to ${user.email}`, tone: "success" });
    close();
  };
  const submit = (): void => {
    if (invite.isPending) return;
    if (name.length === 0 || !EMAIL.test(email)) return setShowErrors(true);
    const phone = draft.phone.trim();
    invite.mutate(
      { name, email, ...(phone.length > 0 ? { phone } : {}) },
      {
        onSuccess,
        onError: (error) => toast.show({ title: inviteErrorTitle(error), tone: "danger" }),
      },
    );
  };
  return {
    draft,
    set: (patch: Partial<InviteDraft>): void => setDraft((prev) => ({ ...prev, ...patch })),
    nameError: showErrors && name.length === 0 ? "Enter the person's name" : undefined,
    emailError: showErrors && !EMAIL.test(email) ? "Enter a valid email address" : undefined,
    pending: invite.isPending,
    submit,
    close,
  };
}

interface InviteFieldsProps {
  readonly draft: InviteDraft;
  readonly set: (patch: Partial<InviteDraft>) => void;
  readonly nameError: string | undefined;
  readonly emailError: string | undefined;
}

/** Name, email and an optional phone. */
function InviteFields({ draft, set, nameError, emailError }: InviteFieldsProps) {
  return (
    <Stack gap={3}>
      <Input
        label="Name"
        required
        value={draft.name}
        onChangeText={(value) => set({ name: value })}
        placeholder="Eva Menon"
        errorText={nameError}
        autoCapitalize="words"
        testID="invite-name"
      />
      <Input
        label="Email"
        required
        value={draft.email}
        onChangeText={(value) => set({ email: value })}
        placeholder="eva@example.com"
        errorText={emailError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        testID="invite-email"
      />
      <Input
        label="Phone"
        value={draft.phone}
        onChangeText={(value) => set({ phone: value })}
        placeholder="+91 98000 00000"
        keyboardType="phone-pad"
        helpText="Optional"
        testID="invite-phone"
      />
    </Stack>
  );
}

/**
 * Invite a new staff member (TW-90): name, email and an optional phone. The person starts `invited`;
 * feature 5.2 sends the invitation and activates them. On success a toast confirms and the directory
 * refreshes; a duplicate email is named, not shown as a generic failure.
 *
 *   <InviteStaffSheet open={open} onClose={() => setOpen(false)} />
 */
export function InviteStaffSheet({ open, onClose }: InviteStaffSheetProps) {
  const { draft, set, nameError, emailError, pending, submit, close } = useInviteForm(onClose);
  return (
    <Sheet
      open={open}
      onClose={close}
      title="Invite a staff member"
      testID="invite-staff"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="invite-staff-submit">
          Send invitation
        </Button>
      }
    >
      <InviteFields draft={draft} set={set} nameError={nameError} emailError={emailError} />
    </Sheet>
  );
}
