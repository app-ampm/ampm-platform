import { useState } from "react";

import { useReinviteStaffUser, useSetStaffUserStatus, useUpdateStaffUser } from "@ampm/api-client";
import type { StaffUserView } from "@ampm/core";
import { Button, Card, ConfirmSheet, Stack, Text, useToast } from "@ampm/ui";

type Confirm = "disable" | "reset" | null;

interface StatusActionProps {
  readonly user: StaffUserView;
  readonly onDisable: () => void;
  readonly onEnable: () => void;
  readonly onResend: () => void;
  readonly pending: boolean;
}

/** The lifecycle action for the current status: enable a disabled account, explain a locked one, or
 *  (invited/active) resend the invitation and/or disable the account. */
function StatusAction({ user, onDisable, onEnable, onResend, pending }: StatusActionProps) {
  if (user.status === "disabled") {
    return (
      <Button
        variant="highlight"
        fullWidth
        loading={pending}
        onPress={onEnable}
        testID="enable-account"
      >
        Enable account
      </Button>
    );
  }
  if (user.status === "locked") {
    return (
      <Text variant="bodySmall" tone="muted">
        Locked by the identity service after failed sign-ins. Reset the authenticator if they have
        lost their device.
      </Text>
    );
  }
  return (
    <Stack gap={2}>
      {user.status === "invited" ? (
        <Button
          variant="secondary"
          fullWidth
          loading={pending}
          onPress={onResend}
          testID="resend-invite"
        >
          Resend invitation
        </Button>
      ) : null}
      <Button variant="destructive" fullWidth onPress={onDisable} testID="disable-account">
        Disable account
      </Button>
    </Stack>
  );
}

/** The management mutations and their toasts, kept out of the view so each function stays small. */
function useStaffUserActions(user: StaffUserView) {
  const toast = useToast();
  const setStatus = useSetStaffUserStatus(user.id);
  const update = useUpdateStaffUser(user.id);
  const reinvite = useReinviteStaffUser(user.id);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const done = (title: string) => (): void => {
    toast.show({ title, tone: "success" });
    setConfirm(null);
  };
  const failed = (title: string) => (): void => void toast.show({ title, tone: "danger" });
  return {
    confirm,
    setConfirm,
    statusPending: setStatus.isPending,
    updatePending: update.isPending,
    reinvitePending: reinvite.isPending,
    disable: (): void =>
      setStatus.mutate(
        { status: "disabled" },
        { onSuccess: done("Account disabled"), onError: failed("Could not disable the account") },
      ),
    enable: (): void =>
      setStatus.mutate(
        { status: "active" },
        { onSuccess: done("Account enabled"), onError: failed("Could not enable the account") },
      ),
    resetAuthenticator: (): void =>
      update.mutate(
        { mfaEnabled: false },
        {
          onSuccess: done("Authenticator reset"),
          onError: failed("Could not reset the authenticator"),
        },
      ),
    resend: (): void =>
      reinvite.mutate(undefined, {
        onSuccess: done("Invitation resent"),
        onError: failed("Could not resend the invitation"),
      }),
  };
}

/** The two destructive confirmations (disable, reset authenticator) on bottom sheets. */
function StaffUserConfirmSheets({
  user,
  actions,
}: {
  readonly user: StaffUserView;
  readonly actions: ReturnType<typeof useStaffUserActions>;
}) {
  const { confirm, setConfirm, statusPending, updatePending, disable, resetAuthenticator } =
    actions;
  const close = (): void => setConfirm(null);
  return (
    <>
      <ConfirmSheet
        open={confirm === "disable"}
        onClose={close}
        destructive
        title={`Disable ${user.name}?`}
        description="They lose access to the workspace immediately. You can enable the account again later."
        confirmLabel="Disable account"
        loading={statusPending}
        onConfirm={disable}
        testID="confirm-disable"
      />
      <ConfirmSheet
        open={confirm === "reset"}
        onClose={close}
        destructive
        title="Reset authenticator?"
        description={`${user.name} sets up their authenticator app again at their next sign-in.`}
        confirmLabel="Reset authenticator"
        loading={updatePending}
        onConfirm={resetAuthenticator}
        testID="confirm-reset"
      />
    </>
  );
}

/**
 * The Super-Admin management actions on a staff user's record (TW-90): enable or disable the account,
 * resend a pending invitation, and reset the authenticator (forcing re-enrolment). Destructive steps
 * confirm on a sheet; every outcome is a toast. Role assignment is the next slice.
 *
 *   <StaffUserActions user={user} />
 */
export function StaffUserActions({ user }: { readonly user: StaffUserView }) {
  const actions = useStaffUserActions(user);
  const { setConfirm, statusPending, reinvitePending, enable, resend } = actions;
  return (
    <Card className="md:p-6" testID="staff-user-actions">
      <Stack gap={3.5}>
        <Text variant="subheading">Manage</Text>
        <StatusAction
          user={user}
          onDisable={() => setConfirm("disable")}
          onEnable={enable}
          onResend={resend}
          pending={statusPending || reinvitePending}
        />
        {user.mfaEnabled ? (
          <Button
            variant="destructive"
            fullWidth
            onPress={() => setConfirm("reset")}
            testID="reset-authenticator"
          >
            Reset authenticator
          </Button>
        ) : null}
      </Stack>
      <StaffUserConfirmSheets user={user} actions={actions} />
    </Card>
  );
}
