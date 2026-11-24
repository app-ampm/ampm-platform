import type { ReactNode } from "react";

import { uiCopy } from "../../copy";
import { Button } from "../button";
import { Stack } from "../layout";
import { Sheet } from "../sheet";
import { Text } from "../text";

export interface ConfirmSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  /** The dismiss label; defaults to `uiCopy.cancel`. */
  readonly cancelLabel?: string | undefined;
  /** A gold-outline confirm (never red) for a destructive step; peacock for a positive one. */
  readonly destructive?: boolean | undefined;
  readonly loading?: boolean | undefined;
  readonly onConfirm: () => void;
  /** What the step needs beyond a yes, under the description: a reason to give, say. */
  readonly children?: ReactNode;
  readonly testID?: string | undefined;
}

type ActionsProps = Pick<
  ConfirmSheetProps,
  "confirmLabel" | "cancelLabel" | "onConfirm" | "onClose" | "testID"
> & { readonly destructive: boolean; readonly loading: boolean };

/** The step, then Cancel; both wait while it runs. */
function ConfirmActions({
  confirmLabel,
  cancelLabel,
  destructive,
  loading,
  onConfirm,
  onClose,
  testID,
}: ActionsProps) {
  return (
    <Stack gap={2}>
      <Button
        fullWidth
        variant={destructive ? "destructive" : "highlight"}
        loading={loading}
        onPress={onConfirm}
        testID={testID ? `${testID}-confirm` : undefined}
      >
        {confirmLabel}
      </Button>
      <Button fullWidth variant="secondary" disabled={loading} onPress={onClose}>
        {cancelLabel ?? uiCopy.cancel}
      </Button>
    </Stack>
  );
}

/**
 * A confirmation on the Peacock Night bottom sheet: the action, then Cancel. Used to confirm a step that
 * is consequential or hard to reverse — disabling an account, resetting an authenticator, closing or
 * merging a lead. (A centred desktop dialog is a later H1.0 primitive; the sheet is the cross-platform
 * confirm we have today.)
 *
 *   <ConfirmSheet open={open} onClose={close} title="Disable Eva?" description="…" confirmLabel="Disable" destructive onConfirm={disable} />
 *   <ConfirmSheet … confirmLabel="Revoke" destructive onConfirm={revoke}><Input label="Reason" … /></ConfirmSheet>
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  onConfirm,
  children,
  testID,
}: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      testID={testID}
      footer={
        <ConfirmActions
          {...{ confirmLabel, cancelLabel, destructive, loading, onConfirm, onClose, testID }}
        />
      }
    >
      <Text variant="body" tone="body">
        {description}
      </Text>
      {children}
    </Sheet>
  );
}
