import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { Button } from "../button";
import { GlassPanel } from "../glass-panel";
import { Text } from "../text";
import {
  screenHeaderActionsStyles,
  screenHeaderBodyStyles,
  screenHeaderStyles,
  screenHeaderSubtitleStyles,
  screenHeaderTextStyles,
  screenHeaderTitleGroupStyles,
  screenHeaderTitleRowStyles,
  screenHeaderTitleStyles,
  type ScreenHeaderSize,
  type ScreenHeaderVariant,
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
  /** Right after the title, read with it: the record's StatusChip (T3 "Demo granted"). */
  readonly badge?: ReactNode;
  /**
   * The page's buttons or its section strip (T2 Board / List and New lead, T3, T4, T12): at the right
   * of the whole header from 768, wrapping under the subtitle on a phone.
   */
  readonly actions?: ReactNode;
  /** plain (default) · panel: the header on its own glass panel, for a record's page (T3). */
  readonly variant?: ScreenHeaderVariant | undefined;
  /** title (default): Gilda 36, 44 from 1024 · display: Gilda 64 for wide desktop pages · hero: 44, 88 from 1024 (D1). */
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
  /** Takes the row's spare width; not when a badge follows it, which would then sit far right. */
  readonly grow: boolean;
}

function Title({ title, emphasis, size, className, grow }: TitleProps) {
  const sizeClass = cn(screenHeaderTitleStyles({ size }), className);
  return (
    <Text variant={size} className={cn(grow ? "flex-1" : "shrink", sizeClass)}>
      {title}
      {emphasis ? (
        <>
          {" "}
          {/* Part of the heading's text, not a second heading. */}
          <Text variant={size} tone="brand" accessibilityRole="none" className={sizeClass}>
            {emphasis}
          </Text>
        </>
      ) : null}
    </Text>
  );
}

type HeaderTextProps = Pick<
  ScreenHeaderProps,
  "title" | "emphasis" | "eyebrow" | "subtitle" | "trailing" | "badge" | "titleClassName"
> & { readonly size: ScreenHeaderSize };

/** The eyebrow, the title with its badge and trailing element, and the subtitle. */
function HeaderText({
  title,
  emphasis,
  eyebrow,
  subtitle,
  trailing,
  badge,
  ...type
}: HeaderTextProps) {
  const heading = (
    <Title
      title={title}
      emphasis={emphasis}
      size={type.size}
      className={type.titleClassName}
      grow={!badge}
    />
  );
  return (
    <View className={screenHeaderTextStyles({ size: type.size })}>
      {eyebrow ? <Text variant="eyebrow">{eyebrow}</Text> : null}
      <View className={screenHeaderTitleRowStyles}>
        {badge ? (
          <View className={screenHeaderTitleGroupStyles}>
            {heading}
            {badge}
          </View>
        ) : (
          heading
        )}
        {trailing ? <View className="shrink-0">{trailing}</View> : null}
      </View>
      {subtitle ? (
        <Text className={screenHeaderSubtitleStyles({ size: type.size })}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

/**
 * The top of a screen: an optional glass back button, then the eyebrow, the Gilda Display title (one
 * word in gold at most) with a status badge after it and a trailing element at its right, and a
 * subtitle in pearl 80%. The page's actions sit at the right of the whole block from 768 and wrap under
 * it on a phone; `variant="panel"` sets a record's header on its own glass (T3). The title is the
 * screen's heading for screen readers. Put it in `Screen`'s `header` slot.
 *
 *   <ScreenHeader title="Welcome" emphasis="back." subtitle="We sent a code to the number AMPM has for you." />
 *   <ScreenHeader eyebrow="Hello, Ananya" title="Find your venue" trailing={<Avatar name="Ananya Sharma" tone="highlight" />} />
 *   <ScreenHeader title="Raj Niwas Palace" eyebrow="Udaipur · Lake Pichola" onBack={router.back} />
 *   <ScreenHeader size="hero" title="Welcome" emphasis="back." subtitle="Sign in with the mobile number AMPM has on file." />
 *   <ScreenHeader eyebrow="Leads and clients · 24 open" title="Pipeline" actions={<Button variant="primary">New lead</Button>} />
 *   <ScreenHeader variant="panel" title="Rohit Malhotra" badge={<StatusChip …/>} subtitle="Delhi · Dec 2027" actions={…} />
 */
export function ScreenHeader({
  onBack,
  backLabel = uiCopy.screenHeader.back,
  size = "title",
  variant = "plain",
  actions,
  className,
  ...rest
}: ScreenHeaderProps) {
  const { title, emphasis, eyebrow, subtitle, trailing, badge, titleClassName, ...view } = rest;
  const text = { title, emphasis, eyebrow, subtitle, trailing, badge, titleClassName, size };
  const Frame = variant === "panel" ? GlassPanel : View;
  const back = onBack ? (
    <Button variant="glass" icon="arrow-left" accessibilityLabel={backLabel} onPress={onBack} />
  ) : null;
  return (
    <Frame className={cn(screenHeaderStyles({ size, variant }), className)} {...view}>
      {variant === "plain" ? back : null}
      <View className={screenHeaderBodyStyles}>
        {/* A panel keeps its back button beside the title from 768, so the record's header stays compact. */}
        {variant === "panel" ? back : null}
        <HeaderText {...text} />
        {actions ? <View className={screenHeaderActionsStyles}>{actions}</View> : null}
      </View>
    </Frame>
  );
}
