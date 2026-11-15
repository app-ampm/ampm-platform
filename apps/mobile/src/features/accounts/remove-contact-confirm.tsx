import { useRemoveAccountContact } from "@ampm/api-client";
import { isAppError, type AccountContactView } from "@ampm/core";
import { ConfirmSheet, useToast } from "@ampm/ui";

export interface RemoveContactConfirmProps {
  readonly accountId: string;
  /** The contact to remove, or null while nothing is being removed. */
  readonly contact: AccountContactView | null;
  readonly onClose: () => void;
}

/**
 * Confirm removing a contact who has no portal login. It is a soft delete (nothing is erased), so the
 * wording says it leaves the client's record rather than that it is gone for good.
 */
export function RemoveContactConfirm({ accountId, contact, onClose }: RemoveContactConfirmProps) {
  const toast = useToast();
  const remove = useRemoveAccountContact(accountId, contact?.id ?? "");
  const confirm = (): void => {
    if (remove.isPending) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        toast.show({ title: "Contact removed", tone: "success" });
        onClose();
      },
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not remove the contact",
          tone: "danger",
        }),
    });
  };
  return (
    <ConfirmSheet
      open={contact !== null}
      onClose={onClose}
      title={contact ? `Remove ${contact.name}?` : "Remove contact?"}
      description="They leave this client's contacts. Anything already recorded with them stays."
      confirmLabel="Remove contact"
      destructive
      loading={remove.isPending}
      onConfirm={confirm}
      testID="remove-contact"
    />
  );
}
