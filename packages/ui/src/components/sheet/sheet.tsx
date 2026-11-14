import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { uiCopy } from "../../copy";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { GlassPanel } from "../glass-panel";
import { useLayoutAt } from "../layout/use-layout-at";
import { Text } from "../text";

export interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  /** Actions pinned under the content. */
  readonly footer?: ReactNode | undefined;
  /** `auto` grows with the content, `half` and `full` are fixed heights. Ignored by the dialog. */
  readonly size?: "auto" | "half" | "full" | undefined;
  readonly closeLabel?: string | undefined;
  readonly testID?: string | undefined;
}

// A sheet below 768 and a centred dialog from there, on every platform (docs/design/peacock-night.md
// §7): a phone, or a narrow browser window, slides a sheet up from the bottom edge; a tablet or a
// desktop has no edge to reach for, so an edit or a confirm is a panel in the middle of the scrim. The
// width decides, not the platform, so a narrow window gets the phone's sheet. Only the layout differs —
// same glass, scrim, title and close — and the tree is the same, so a form inside keeps what was typed
// when the window crosses 768.

const SIZE = { auto: "max-h-full", half: "h-1/2", full: "h-full rounded-t-none" } as const;

/**
 * The bottom-sheet panel (a phone): base glass with only its top edge stroked, radius 28 on the top
 * corners, the phone's 18 gutter. GlassPanel blurs on iOS and draws the opaque fallback on Android.
 */
const PANEL = "rounded-none rounded-t-2xl border-0 border-t px-4.5 pt-3";

/**
 * The centred-dialog panel (768 and up): the full glass border and radius a dialog wants, a
 * comfortable form width with a desktop's 24 inside, and a height capped to the viewport (the
 * container's padding) so long forms scroll inside.
 */
const DIALOG_PANEL = "w-full max-w-lg self-center rounded-2xl px-6 pt-5 max-h-full";

function SheetHeader({
  title,
  closeLabel,
  onClose,
  handle,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  /** The pearl drag handle: a bottom sheet is dragged, a centred dialog is not. */
  handle: boolean;
}) {
  return (
    <>
      {handle ? <View className="mb-3 h-1 w-10 self-center rounded-full bg-primary/26" /> : null}
      <View className="mb-2 flex-row items-center justify-between gap-2">
        <Text variant="heading" className="flex-1" numberOfLines={2}>
          {title}
        </Text>
        <Button
          variant="glass"
          size="sm"
          icon="x"
          accessibilityLabel={closeLabel}
          onPress={onClose}
        />
      </View>
    </>
  );
}

interface ScrimProps {
  readonly onClose: () => void;
  readonly label: string;
  readonly testID: string | undefined;
}

function SheetScrim({ onClose, label, testID }: ScrimProps) {
  return (
    <Pressable
      // Absolute: the midnight 70% scrim fills the screen behind the panel and closes the sheet.
      className="absolute inset-0 bg-overlay/70"
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID ? `${testID}-scrim` : undefined}
    />
  );
}

function SheetBody({ children, footer }: { children: ReactNode; footer: ReactNode | undefined }) {
  return (
    <>
      <ScrollView
        className="shrink"
        contentContainerClassName="gap-3 pb-2"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {footer ? <View className="gap-2 pt-3">{footer}</View> : null}
    </>
  );
}

interface PanelProps extends Pick<
  SheetProps,
  "title" | "children" | "footer" | "onClose" | "testID"
> {
  readonly isDialog: boolean;
  readonly size: NonNullable<SheetProps["size"]>;
  readonly closeLabel: string;
}

/** The glass panel: a bottom sheet's or a dialog's shape, with the header, the body and the footer. */
function SheetPanel({
  isDialog,
  size,
  title,
  closeLabel,
  onClose,
  footer,
  children,
  testID,
}: PanelProps) {
  const insets = useSafeAreaInsets();
  return (
    <GlassPanel
      accessibilityViewIsModal
      className={isDialog ? DIALOG_PANEL : cn(PANEL, SIZE[size])}
      // The home indicator's inset is a run-time number; the 16 above it is the class below.
      style={{ paddingBottom: isDialog ? 0 : insets.bottom }}
      testID={testID ? `${testID}-panel` : undefined}
    >
      <View
        className={cn("shrink", isDialog ? "pb-6" : "pb-4")}
        testID={testID ? `${testID}-content` : undefined}
      >
        <SheetHeader title={title} closeLabel={closeLabel} onClose={onClose} handle={!isDialog} />
        <SheetBody footer={footer}>{children}</SheetBody>
      </View>
    </GlassPanel>
  );
}

/**
 * A modal panel in Peacock Night glass: a bottom sheet below 768, a centred dialog from there, both
 * on a midnight 70% scrim. Base-glass panel (radius 28), a Gilda Display title and a glass close button.
 * Focus stays inside (React Native Web traps it, native treats it as a modal view), the scrim and the
 * close button both dismiss (the browser's Escape too), the motion respects reduced motion.
 *
 *   <Sheet open={open} onClose={close} title="Filters" footer={<Button onPress={apply}>Apply</Button>}>...</Sheet>
 */
export function Sheet({
  open,
  onClose,
  size = "auto",
  closeLabel = uiCopy.close,
  testID,
  ...content
}: SheetProps) {
  const reducedMotion = useReducedMotion();
  const isDialog = useLayoutAt("md");
  const animationType = reducedMotion ? "none" : isDialog ? "fade" : "slide";
  return (
    <Modal
      visible={open}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      <View className={cn("flex-1", isDialog ? "items-center justify-center p-6" : "justify-end")}>
        <SheetScrim onClose={onClose} label={closeLabel} testID={testID} />
        <SheetPanel {...content} {...{ isDialog, size, closeLabel, onClose, testID }} />
      </View>
    </Modal>
  );
}
