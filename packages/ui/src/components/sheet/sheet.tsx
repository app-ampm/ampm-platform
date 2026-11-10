import { type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { uiCopy } from "../../copy";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { GlassPanel } from "../glass-panel";
import { Text } from "../text";

export interface SheetProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly children: ReactNode;
  /** Actions pinned under the content. */
  readonly footer?: ReactNode | undefined;
  /** `auto` grows with the content, `half` and `full` are fixed heights. Ignored on the web dialog. */
  readonly size?: "auto" | "half" | "full" | undefined;
  readonly closeLabel?: string | undefined;
  readonly testID?: string | undefined;
}

// The web renders a centred dialog, not a bottom sheet (docs/design/peacock-night.md §7): a phone slides
// a sheet up from the bottom edge, a desktop has no bottom edge to reach for, so an edit or a confirm is
// a panel in the middle of the scrim. Only the layout differs — same glass, scrim, title and close.
const IS_WEB = Platform.OS === "web";

const SIZE = { auto: "max-h-full", half: "h-1/2", full: "h-full rounded-t-none" } as const;

/**
 * The bottom-sheet panel (native): base glass with only its top edge stroked, radius 28 on the top
 * corners, the phone's 18 gutter. GlassPanel blurs on iOS and draws the opaque fallback on Android.
 */
const PANEL = "rounded-none rounded-t-2xl border-0 border-t px-4.5 pt-3";

/**
 * The centred-dialog panel (web): the full glass border and radius a dialog wants, a comfortable form
 * width, and a height capped to the viewport (the container's padding) so long forms scroll inside.
 */
const WEB_PANEL = "w-full max-w-lg self-center rounded-2xl px-4.5 pt-3 max-h-full";

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

/**
 * A modal panel in Peacock Night glass: a bottom sheet on a phone, a centred dialog on a desktop, both
 * on a midnight 70% scrim. Base-glass panel (radius 28), a Gilda Display title and a glass close button.
 * Focus stays inside (React Native Web traps it, native treats it as a modal view), the scrim and the
 * close button both dismiss (the browser's Escape too), the motion respects reduced motion.
 *
 *   <Sheet open={open} onClose={close} title="Filters" footer={<Button onPress={apply}>Apply</Button>}>...</Sheet>
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  size = "auto",
  closeLabel = uiCopy.close,
  testID,
}: SheetProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const animationType = reducedMotion ? "none" : IS_WEB ? "fade" : "slide";
  return (
    <Modal
      visible={open}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      <View className={cn("flex-1", IS_WEB ? "items-center justify-center p-6" : "justify-end")}>
        <SheetScrim onClose={onClose} label={closeLabel} testID={testID} />
        <GlassPanel
          accessibilityViewIsModal
          className={cn(IS_WEB ? WEB_PANEL : PANEL, IS_WEB ? "" : SIZE[size])}
          // The home indicator's inset is a run-time number; the 16 above it is the class below.
          style={{ paddingBottom: IS_WEB ? 0 : insets.bottom }}
          testID={testID ? `${testID}-panel` : undefined}
        >
          <View className="shrink pb-4" testID={testID ? `${testID}-content` : undefined}>
            <SheetHeader title={title} closeLabel={closeLabel} onClose={onClose} handle={!IS_WEB} />
            <SheetBody footer={footer}>{children}</SheetBody>
          </View>
        </GlassPanel>
      </View>
    </Modal>
  );
}
