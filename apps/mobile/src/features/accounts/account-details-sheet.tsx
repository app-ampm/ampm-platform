import { useEffect, useState } from "react";

import { useUpdateAccount } from "@ampm/api-client";
import { isAppError, type AccountDetailView } from "@ampm/core";
import { Button, Input, Sheet, Stack, useToast } from "@ampm/ui";

import { AccountCoupleFields } from "./account-couple-fields";
import {
  buildDetailsUpdate,
  detailsDraftOf,
  draftCoupleTitle,
  validateDetails,
  type DetailsDraft,
  type DetailsErrors,
} from "./account-details.form";

const NO_ERRORS: DetailsErrors = { name: undefined };

/** The details form's draft, validation and save (only the changed fields are sent). */
function useDetailsForm(account: AccountDetailView, open: boolean, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateAccount(account.id);
  const [draft, setDraft] = useState<DetailsDraft>(() => detailsDraftOf(account));
  const [showErrors, setShowErrors] = useState(false);
  useEffect(() => {
    if (!open) return;
    setDraft(detailsDraftOf(account));
    setShowErrors(false);
  }, [open, account]);
  const patch = (next: Partial<DetailsDraft>): void => setDraft((prev) => ({ ...prev, ...next }));
  const submit = (): void => {
    if (update.isPending) return;
    if (validateDetails(draft).name) return setShowErrors(true);
    const body = buildDetailsUpdate(draft, account);
    if (body === null) return onClose();
    update.mutate(body, {
      onSuccess: () => {
        toast.show({ title: "Details saved", tone: "success" });
        onClose();
      },
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : "Could not save the details",
          tone: "danger",
        }),
    });
  };
  const errors = showErrors ? validateDetails(draft) : NO_ERRORS;
  return { draft, patch, errors, pending: update.isPending, submit };
}

interface FieldsProps {
  readonly draft: DetailsDraft;
  readonly patch: (next: Partial<DetailsDraft>) => void;
  readonly errors: DetailsErrors;
}

/**
 * The client's name: typed until the bride and groom are both named, then their names ("Priya &
 * Arjun"), shown here as they will save and not typed over.
 */
function NameField({ draft, patch, errors }: FieldsProps) {
  const coupleName = draftCoupleTitle(draft);
  return (
    <Input
      label="Client name"
      required={coupleName === null}
      disabled={coupleName !== null}
      value={coupleName ?? draft.name}
      onChangeText={(name) => patch({ name })}
      helpText={
        coupleName === null
          ? "Becomes the couple's names once the bride and groom are given."
          : "Follows the bride's and the groom's names."
      }
      maxLength={255}
      errorText={errors.name}
      testID="account-name"
    />
  );
}

/** What the team knows: where they would marry, and the internal notes that never reach them. */
function NoteFields({ draft, patch }: Omit<FieldsProps, "errors">) {
  return (
    <>
      <Input
        label="Preferred locations"
        value={draft.preferredLocations}
        onChangeText={(preferredLocations) => patch({ preferredLocations })}
        multiline
        maxLength={10_000}
        testID="account-locations"
      />
      <Input
        label="Internal notes"
        value={draft.internalNotes}
        onChangeText={(internalNotes) => patch({ internalNotes })}
        helpText="Staff only. Never shown to the client."
        multiline
        maxLength={10_000}
        testID="account-notes"
      />
    </>
  );
}

export interface AccountDetailsSheetProps {
  readonly account: AccountDetailView;
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Edit a client account's details (TW-13 Overview and Notes): its name, the couple (bride and groom with
 * their fathers), the preferred locations and the internal notes, which are staff-only (RESTRICTED-NOTES)
 * and never reach the client. An emptied optional box clears its field; the name may not be emptied
 * while it is typed, and follows the couple once both are named.
 */
export function AccountDetailsSheet({ account, open, onClose }: AccountDetailsSheetProps) {
  const { draft, patch, errors, pending, submit } = useDetailsForm(account, open, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit details"
      testID="account-details-sheet"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="account-details-save">
          Save details
        </Button>
      }
    >
      <Stack gap={4}>
        <NameField draft={draft} patch={patch} errors={errors} />
        <AccountCoupleFields draft={draft} patch={patch} />
        <NoteFields draft={draft} patch={patch} />
      </Stack>
    </Sheet>
  );
}
