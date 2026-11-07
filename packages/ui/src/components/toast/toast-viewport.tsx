import { useEffect, useRef } from "react";
import { Animated, Easing, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { motionBezier, motionMs } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { announcementText, politeLiveRegion, useAnnounce } from "../../hooks/use-announce";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { AnimatedView } from "../../lib/animated-view";
import { Button } from "../button";
import { TextAction } from "../callout/text-action";
import { GlassPanel } from "../glass-panel";
import { Icon, type IconName, type IconTone } from "../icon";
import { Text } from "../text";
import { toastFrameStyles, toastRowStyles, toastStyles, toastViewportStyles } from "./toast.styles";
import type { ToastItem, ToastTone } from "./toast.types";

// react-native-web has no native animated module; the JS driver is the only one on the web.
const NATIVE_DRIVER = Platform.OS !== "web";

/** Glass panels arrive from 8 points away (the toast drops in from above), easing out. */
const ENTER_OFFSET = -8;
const ENTER_EASING = Easing.bezier(...motionBezier.decelerate);

/** The leading icon carries the tone: peacock for done, gold for a problem, pearl for a note. */
export const toastIcons: Record<ToastTone, { readonly name: IconName; readonly tone: IconTone }> = {
  neutral: { name: "info", tone: "primary" },
  info: { name: "info", tone: "primary" },
  success: { name: "check-circle", tone: "highlight" },
  warning: { name: "alert-triangle", tone: "brand" },
  danger: { name: "alert-circle", tone: "brand" },
};

interface ToastViewportProps {
  readonly items: readonly ToastItem[];
  readonly onDismiss: (id: number) => void;
  readonly dismissLabel?: string | undefined;
}

/**
 * Where ToastProvider draws its toasts: newest first, under the status bar, each on base glass with
 * its tone icon. Mounted by the provider only; screens call `useToast().show(...)`.
 *
 *   <ToastViewport items={items} onDismiss={dismiss} />
 */
export function ToastViewport({
  items,
  onDismiss,
  dismissLabel = uiCopy.dismiss,
}: ToastViewportProps) {
  const insets = useSafeAreaInsets();
  if (items.length === 0) return null;
  return (
    <View
      // Absolute: toasts float over the screen under the status bar and never take layout space.
      className={toastViewportStyles}
      style={{ top: insets.top }}
      pointerEvents="box-none"
      testID="toast-viewport"
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={onDismiss} dismissLabel={dismissLabel} />
      ))}
    </View>
  );
}

function ToastBody({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text variant="label" tone="primary">
        {item.title}
      </Text>
      {item.description ? (
        <Text variant="bodySmall" tone="body">
          {item.description}
        </Text>
      ) : null}
      {item.action ? (
        <TextAction
          label={item.action.label}
          className="mt-1.5"
          onPress={() => {
            item.action?.onPress();
            onDismiss(item.id);
          }}
        />
      ) : null}
    </View>
  );
}

interface ToastCardProps {
  readonly item: ToastItem;
  readonly onDismiss: (id: number) => void;
  readonly dismissLabel: string;
}

/** Runs the card's entrance from 0 to 1; with reduced motion it starts at its end state. */
function useEnterProgress(): Animated.Value {
  const reducedMotion = useReducedMotion();
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: reducedMotion ? 0 : motionMs.base,
      easing: ENTER_EASING,
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [progress, reducedMotion]);
  return progress;
}

/**
 * One toast. It rises 8 as it arrives while its contents fade in: the glass itself is never under an
 * animated opacity, because an ancestor below opacity 1 switches the web's backdrop blur off until it
 * reaches 1 (the blur would pop in) and an iOS BlurView under a translucent parent draws wrongly.
 */
function ToastCard({ item, onDismiss, dismissLabel }: ToastCardProps) {
  const icon = toastIcons[item.tone ?? "neutral"];
  const progress = useEnterProgress();
  // Spoken through VoiceOver on iOS, the page's live region on the web and the card's own live
  // region on Android: a status inserted together with its text is not reliably spoken.
  useAnnounce(announcementText(item.title, item.description), true, { web: true });
  const rise = progress.interpolate({ inputRange: [0, 1], outputRange: [ENTER_OFFSET, 0] });
  return (
    <AnimatedView
      {...politeLiveRegion()}
      className={toastFrameStyles}
      style={{ transform: [{ translateY: rise }] }}
      testID={`toast-${item.id}`}
    >
      <GlassPanel className={toastStyles} testID={`toast-${item.id}-panel`}>
        <AnimatedView
          className={toastRowStyles}
          style={{ opacity: progress }}
          testID={`toast-${item.id}-content`}
        >
          <Icon name={icon.name} tone={icon.tone} />
          <ToastBody item={item} onDismiss={onDismiss} />
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            // The 44px target overlaps the padding so the row stays as tall as its first line.
            className="-my-3"
            accessibilityLabel={dismissLabel}
            onPress={() => onDismiss(item.id)}
          />
        </AnimatedView>
      </GlassPanel>
    </AnimatedView>
  );
}
