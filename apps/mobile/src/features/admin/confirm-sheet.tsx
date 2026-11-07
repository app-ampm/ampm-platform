import { Button, Sheet, Stack, Text } from "@ampm/ui";

export interface ConfirmSheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  /** A gold-outline confirm (never red) for a destructive step; peacock for a positive one. */
  readonly destructive?: boolean | undefined;
  readonly loading?: boolean | undefined;
  readonly onConfirm: () => void;
  readonly testID?: string | undefined;
}

/**
 * A confirmation on the Peacock Night bottom sheet: the action, then Cancel. Used to confirm disabling
 * an account and resetting an authenticator. (A centred desktop dialog is a later H1.0 primitive; the
 * sheet is the cross-platform confirm we have today.)
 *
 *   <ConfirmSheet open={open} onClose={close} title="Disable Eva?" description="…" confirmLabel="Disable" destructive onConfirm={disable} />
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  destructive = false,
  loading = false,
  onConfirm,
  testID,
}: ConfirmSheetProps) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      testID={testID}
      footer={
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
            Cancel
          </Button>
        </Stack>
      }
    >
      <Text variant="body" tone="body">
        {description}
      </Text>
    </Sheet>
  );
}
