import type { ReactNode } from "react";
import { useWindowDimensions, View, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "../../lib/cn";
import { cardFrameStyles, type CardPadding } from "../card/card.styles";
import { GlassPanel } from "../glass-panel";
import { Columns, Stack } from "../layout";
import { Screen } from "../screen";
import { Text } from "../text";
import {
  signInAsideGap,
  signInAsideStyles,
  signInCardBodyGap,
  signInColumnsGap,
  signInContentStyles,
  signInFootnoteStyles,
  signInFormCardStyles,
  signInFormColumnStyles,
  signInFrameStyles,
  signInGlow,
  signInHeroColumnStyles,
} from "./sign-in-layout.styles";
import { useSignInLayoutMode, type SignInLayoutMode } from "./use-sign-in-layout-mode";

/** What fills the page; the arrangement decides where each piece goes. */
export interface SignInLayoutSlots {
  /** At the top of the page: the wordmark. */
  readonly brand?: ReactNode;
  /** The headline: a `ScreenHeader`, `size="hero"` from 1024 (`useSignInLayoutMode`). */
  readonly hero: ReactNode;
  /** The sign-in form, inside the one glass card. It keeps its state at every width. */
  readonly card: ReactNode;
  /** The card's title: Gilda 36 from 1024 (D1), an eyebrow over the form below it. */
  readonly cardTitle?: string | undefined;
  /**
   * Quieter ways in after the card (other forms, shortcuts, links), each child a block of its own:
   * under the card from 1024, inside it from 768, after it on a phone.
   */
  readonly aside?: ReactNode;
  /** The eyebrow at the foot of the headline column from 1024 (D1); a phone has none (P1). */
  readonly footer?: string | undefined;
}

export interface SignInLayoutProps extends SignInLayoutSlots, Omit<ViewProps, "children"> {
  /** Classes for the screen's root. */
  readonly className?: string;
  readonly testID?: string | undefined;
}

interface PartProps {
  readonly slots: SignInLayoutSlots;
  readonly mode: SignInLayoutMode;
  /** A part's test ID under the layout's: `sign-in-card`. */
  readonly part: (name: string) => string | undefined;
  /** D1: each column fills at least the visible height (a style: the window's). */
  readonly columnStyle: { readonly minHeight: number } | undefined;
}

/** What the screen shows without scrolling: the window less the safe areas `Screen` keeps clear. */
function useVisibleHeight(): number {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return Math.max(0, height - insets.top - insets.bottom);
}

interface SurfaceProps {
  /** Draw it as a glass card here; otherwise it is a bare box. */
  readonly glass: boolean;
  readonly padding: CardPadding;
  readonly className: string;
  readonly testID: string | undefined;
  readonly children: ReactNode;
}

/**
 * A box that is a glass card in some arrangements and bare in others. A `Card` here and a `View`
 * there would be different elements, so crossing a breakpoint would remount the form inside and lose
 * what was typed (and the code step); only the classes and the glass layer behind change instead.
 */
function GlassSurface({ glass, padding, className, testID, children }: SurfaceProps) {
  return (
    <View
      className={cn(glass && cardFrameStyles({ tone: "glass", padding }), className)}
      testID={testID}
    >
      {glass ? (
        // Absolute: the glass fills the card behind its content, as Card draws it.
        <GlassPanel recipe="base" className="absolute inset-0 rounded-none border-0" />
      ) : null}
      {children}
    </View>
  );
}

/** The wordmark, the headline and, in D1, the eyebrow at the foot. */
function HeroColumn({ slots, mode, part, columnStyle }: PartProps) {
  const isSplit = mode === "split";
  return (
    <View className={signInHeroColumnStyles[mode]} style={columnStyle} testID={part("hero")}>
      {/* D1 spreads three blocks over the column, so the wordmark keeps its place even when absent. */}
      {slots.brand || isSplit ? <View>{slots.brand}</View> : null}
      {slots.hero}
      {isSplit ? (
        <View>
          {slots.footer ? (
            <Text variant="eyebrow" className={signInFootnoteStyles}>
              {slots.footer}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The form card (its title and the form only), then the quieter blocks. */
function FormColumn({ slots, mode, part, columnStyle }: PartProps) {
  const isSplit = mode === "split";
  return (
    <View className={signInFormColumnStyles[mode]} style={columnStyle} testID={part("form")}>
      <GlassSurface
        glass={mode !== "card"}
        padding={isSplit ? "lg" : "md"}
        className={signInFormCardStyles[mode]}
        testID={part("card")}
      >
        <Stack gap={signInCardBodyGap[mode]}>
          {slots.cardTitle ? (
            <Text
              variant={isSplit ? "title" : "eyebrow"}
              accessibilityRole={isSplit ? "header" : undefined}
            >
              {slots.cardTitle}
            </Text>
          ) : null}
          {slots.card}
        </Stack>
      </GlassSurface>
      {slots.aside ? (
        <Stack
          gap={signInAsideGap[mode]}
          className={signInAsideStyles[mode]}
          testID={part("aside")}
        >
          {slots.aside}
        </Stack>
      ) : null}
    </View>
  );
}

/**
 * The sign-in page, laid out once for every sign-in screen: the wordmark, the headline and one glass
 * card holding the form, then quieter ways in. From 1024 it is D1's split: the headline column (with
 * a foot eyebrow) beside the form column, each filling at least the first view, so a long form
 * scrolls on alone. From 768 to 1023 one glass card centred on the canvas holds everything; on a phone
 * the headline heads the screen and glass cards follow (P1). The tree is the same at every width, so
 * the form keeps what was typed when a tablet turns or a window is resized. Content that changes with
 * the arrangement (the headline's size, an aside block's tone) reads `useSignInLayoutMode`.
 *
 *   const mode = useSignInLayoutMode();
 *   <SignInLayout
 *     brand={<Text variant="wordmark">AMPM</Text>}
 *     hero={<ScreenHeader size={mode === "split" ? "hero" : "title"} title="Welcome" emphasis="back." subtitle="…" />}
 *     cardTitle="Client sign-in"
 *     card={<MobileOtpSignIn />}
 *     aside={<Link href="/help">Need help? Contact AMPM</Link>}
 *     footer="No sign-up · AMPM invites every client"
 *   />
 */
export function SignInLayout({
  brand,
  hero,
  card,
  cardTitle,
  aside,
  footer,
  ...screen
}: SignInLayoutProps) {
  const mode = useSignInLayoutMode();
  const minHeight = useVisibleHeight();
  const part = (name: string) => (screen.testID ? `${screen.testID}-${name}` : undefined);
  const slots = { brand, hero, card, cardTitle, aside, footer };
  const parts = { slots, mode, part, columnStyle: mode === "split" ? { minHeight } : undefined };
  return (
    <Screen glow={signInGlow[mode]} contentClassName={signInContentStyles[mode]} {...screen}>
      <GlassSurface
        glass={mode === "card"}
        padding="lg"
        className={signInFrameStyles[mode]}
        testID={part("frame")}
      >
        <Columns gap={signInColumnsGap[mode]} align="start" testID={part("columns")}>
          <HeroColumn {...parts} />
          <FormColumn {...parts} />
        </Columns>
      </GlassSurface>
    </Screen>
  );
}
