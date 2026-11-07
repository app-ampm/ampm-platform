import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { Text } from "../text";
import {
  screenHeaderStyles,
  screenHeaderSubtitleStyles,
  screenHeaderTextStyles,
  screenHeaderTitleRowStyles,
  type ScreenHeaderSize,
} from "./screen-header.styles";

export interface ScreenHeaderProps extends Omit<ViewProps, "children"> {
  readonly title: string;
  /** A last word set in gold: `title="Welcome" emphasis="back."` reads "Welcome back." as one heading. */
  readonly emphasis?: string | undefined;
  /** The small uppercase line over the title: "Friday · 6 Nov 2026", "Hello, Ananya". */
  readonly eyebrow?: string | undefined;
  readonly subtitle?: string | undefined;
  /** Shows the circular glass back button; navigation stays with the app. */
  readonly onBack?: (() => void) | undefined;
  /** The back button's spoken name; defaults to "Back". */
  readonly backLabel?: string | undefined;
  /** At the right of the title: an Avatar, a count Badge, a small action. */
  readonly trailing?: ReactNode;
  /** title (default): Gilda 36 · display: Gilda 64 for wide desktop pages. */
  readonly size?: ScreenHeaderSize | undefined;
  /** Responsive sizes for the title and its gold word: `md:text-5xl`. */
  readonly titleClassName?: string | undefined;
  readonly className?: string;
  readonly testID?: string | undefined;
}

interface TitleProps {
  readonly title: string;
  readonly emphasis: string | undefined;
  readonly size: ScreenHeaderSize;
  readonly className: string | undefined;
}

function Title({ title, emphasis, size, className }: TitleProps) {
  return (
    <Text variant={size} className={cn("flex-1", className)}>
      {title}
      {emphasis ? (
        <>
          {" "}
          {/* Part of the heading's text, not a second heading. */}
          <Text variant={size} tone="brand" accessibilityRole="none" className={cn(className)}>
            {emphasis}
          </Text>
        </>
      ) : null}
    </Text>
  );
}

/**
 * The top of a screen: an optional glass back button, then the eyebrow, the Gilda Display title (one
 * word in gold at most) with a trailing element at its right, and a subtitle in pearl 80%. The title
 * is the screen's heading for screen readers. Put it in `Screen`'s `header` slot.
 *
 *   <ScreenHeader title="Welcome" emphasis="back." subtitle="We sent a code to the number AMPM has for you." />
 *   <ScreenHeader eyebrow="Hello, Ananya" title="Find your venue" trailing={<Avatar name="Ananya Sharma" tone="highlight" />} />
 *   <ScreenHeader title="Raj Niwas Palace" eyebrow="Udaipur · Lake Pichola" onBack={router.back} />
 */
export function ScreenHeader({
  title,
  emphasis,
  eyebrow,
  subtitle,
  onBack,
  backLabel = uiCopy.screenHeader.back,
  trailing,
  size = "title",
  titleClassName,
  className,
  ...rest
}: ScreenHeaderProps) {
  return (
    <View className={cn(screenHeaderStyles({ size }), className)} {...rest}>
      {onBack ? (
        <Button variant="glass" icon="arrow-left" accessibilityLabel={backLabel} onPress={onBack} />
      ) : null}
      <View className={screenHeaderTextStyles}>
        {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
        <View className={screenHeaderTitleRowStyles}>
          <Title title={title} emphasis={emphasis} size={size} className={titleClassName} />
          {trailing ? <View className="shrink-0">{trailing}</View> : null}
        </View>
        {subtitle ? <Text className={screenHeaderSubtitleStyles}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}
