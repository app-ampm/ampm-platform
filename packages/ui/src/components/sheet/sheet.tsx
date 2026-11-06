import { type ReactNode } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
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
  /** `auto` grows with the content, `half` and `full` are fixed heights. */
  readonly size?: "auto" | "half" | "full" | undefined;
  readonly closeLabel?: string | undefined;
  readonly testID?: string | undefined;
}

const SIZE = { auto: "max-h-full", half: "h-1/2", full: "h-full rounded-t-none" } as const;

/**
 * The panel: base glass with only its top edge stroked, radius 28 on the top corners, the phone's
 * 18 gutter. GlassPanel blurs on the web and iOS and draws the opaque fallback on Android.
 */
const PANEL = "rounded-none rounded-t-2xl border-0 border-t px-4.5 pt-3";

function SheetHeader({
  title,
  closeLabel,
  onClose,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <>
      <View className="mb-3 h-1 w-10 self-center rounded-full bg-primary/26" />
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
 * A bottom sheet on a modal, in Peacock Night glass: a midnight 70% scrim, a base-glass panel with
 * radius 28 on its top corners, a pearl handle, a Gilda Display title and a glass close button. Focus
 * stays inside (React Native Web traps it, native treats it as a modal view), the scrim and the close
 * button both dismiss, the slide respects reduced motion.
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
  return (
    <Modal
      visible={open}
      transparent
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
      statusBarTranslucent
      testID={testID}
    >
      <View className="flex-1 justify-end">
        <SheetScrim onClose={onClose} label={closeLabel} testID={testID} />
        <GlassPanel
          accessibilityViewIsModal
          className={cn(PANEL, SIZE[size])}
          // The home indicator's inset is a run-time number; the 16 above it is the class below.
          style={{ paddingBottom: insets.bottom }}
          testID={testID ? `${testID}-panel` : undefined}
        >
          <View className="shrink pb-4" testID={testID ? `${testID}-content` : undefined}>
            <SheetHeader title={title} closeLabel={closeLabel} onClose={onClose} />
            <SheetBody footer={footer}>{children}</SheetBody>
          </View>
        </GlassPanel>
      </View>
    </Modal>
  );
}
