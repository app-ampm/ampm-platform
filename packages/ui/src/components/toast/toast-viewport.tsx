import { useEffect, useRef } from "react";
import { Animated, Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { motionMs } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { announcementText, useAnnounce } from "../../hooks/use-announce";
import { useReducedMotion } from "../../hooks/use-reduced-motion";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Icon, type IconName } from "../icon";
import { chipTextTone } from "../status-chip/status-chip.styles";
import { Text } from "../text";
import type { ToastItem, ToastTone } from "./toast.types";

// react-native-web has no native animated module; the JS driver is the only one on the web.
const NATIVE_DRIVER = Platform.OS !== "web";

const TONE_ICON: Record<ToastTone, IconName> = {
  neutral: "info",
  info: "info",
  success: "check-circle",
  warning: "alert-triangle",
  danger: "alert-circle",
};

const TONE_FRAME: Record<ToastTone, string> = {
  neutral: "border-subtle",
  info: "border-info",
  success: "border-success",
  warning: "border-warning",
  danger: "border-danger",
};

interface ToastViewportProps {
  readonly items: readonly ToastItem[];
  readonly onDismiss: (id: number) => void;
  readonly dismissLabel?: string | undefined;
}

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
      className="absolute inset-x-0 top-0 z-toast items-center gap-2 px-4"
      style={{ paddingTop: insets.top + 8 }}
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
      <Text variant="label">{item.title}</Text>
      {item.description ? (
        <Text variant="bodySmall" tone="muted">
          {item.description}
        </Text>
      ) : null}
      {item.action ? (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3"
          onPress={() => {
            item.action?.onPress();
            onDismiss(item.id);
          }}
        >
          {item.action.label}
        </Button>
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
      useNativeDriver: NATIVE_DRIVER,
    }).start();
  }, [progress, reducedMotion]);
  return progress;
}

function ToastCard({ item, onDismiss, dismissLabel }: ToastCardProps) {
  const tone: ToastTone = item.tone ?? "neutral";
  const progress = useEnterProgress();
  // Role status speaks on the web and the live region on Android; VoiceOver needs the announcement.
  useAnnounce(announcementText(item.title, item.description), true);

  return (
    <Animated.View
      role="status"
      accessibilityLiveRegion="polite"
      className={cn(
        "w-full max-w-md flex-row items-start gap-3 rounded-lg border-l-4 bg-surface-elevated p-3 shadow-md",
        TONE_FRAME[tone],
      )}
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
        ],
      }}
      testID={`toast-${item.id}`}
    >
      <Icon name={TONE_ICON[tone]} tone={chipTextTone[tone]} className="mt-0.5" />
      <ToastBody item={item} onDismiss={onDismiss} />
      <Button
        variant="ghost"
        size="sm"
        icon="x"
        accessibilityLabel={dismissLabel}
        onPress={() => onDismiss(item.id)}
      />
    </Animated.View>
  );
}
