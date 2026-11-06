import {
  forwardRef,
  type ComponentRef,
  type ForwardRefExoticComponent,
  type RefAttributes,
} from "react";
import { Pressable, View, type ViewProps } from "react-native";

import { cn } from "../../lib/cn";
import { GlassPanel } from "../glass-panel";
import { cardFrameStyles, cardGlassRecipe, type CardPadding, type CardTone } from "./card.styles";

export interface CardProps extends ViewProps {
  /** sm 16, md 20 (default), lg 24: phone padding; desktop callers add more (`md:p-7`). */
  readonly padding?: CardPadding | undefined;
  /**
   * `glass` (default) for cards and panels, `peacock` for selected and verified, `gold` for live and
   * needs-you, `flat` for a card nested in a panel, `internal` for staff-only cost and notes.
   */
  readonly tone?: CardTone | undefined;
  /**
   * Glass tones blur what is behind them; a glass card inside another panel passes `false` (only
   * top-level panels blur). Flat and internal cards never blur.
   */
  readonly blur?: boolean | undefined;
  /** Makes the whole card a button; give `accessibilityLabel` when the content is not a sentence. */
  readonly onPress?: (() => void) | undefined;
  readonly className?: string;
}

interface SurfaceProps {
  readonly tone: CardTone;
  readonly blur: boolean;
  readonly pressed: boolean;
}

/** What sits behind the content: the glass (fill, rim, blur) and, while pressed, a pearl wash. */
function CardSurface({ tone, blur, pressed }: SurfaceProps) {
  const recipe = cardGlassRecipe[tone];
  return (
    <>
      {recipe ? (
        // Absolute: the glass fills the card behind its content; the card itself draws the stroke.
        <GlassPanel
          recipe={recipe}
          blur={blur}
          className="absolute inset-0 rounded-none border-0"
        />
      ) : null}
      {pressed ? (
        // Absolute: the pressed wash lies behind the content. A wash, not an opacity change, so the
        // glass keeps its blur (an ancestor below opacity 1 switches backdrop blur off).
        <View className="absolute inset-0 bg-primary/6" />
      ) : null}
    </>
  );
}

interface RootProps extends ViewProps {
  readonly tone: CardTone;
  readonly blur: boolean;
  readonly onPress: (() => void) | undefined;
  readonly className: string;
}

/** A button when the card is pressable (its surface follows the pressed state), a view otherwise. */
const CardRoot = forwardRef<ComponentRef<typeof View>, RootProps>(function CardRoot(
  { tone, blur, onPress, children, ...rest },
  ref,
) {
  if (onPress) {
    return (
      <Pressable ref={ref} accessibilityRole="button" onPress={onPress} {...rest}>
        {({ pressed }) => (
          <>
            <CardSurface tone={tone} blur={blur} pressed={pressed} />
            {children}
          </>
        )}
      </Pressable>
    );
  }
  return (
    <View ref={ref} {...rest}>
      <CardSurface tone={tone} blur={blur} pressed={false} />
      {children}
    </View>
  );
});

/**
 * Peacock Night's card: base glass (radius 22, 24 on a desktop) by default, or the peacock, gold, flat
 * (nested in a panel) and internal (staff only) tones. With `onPress` it becomes a button: the stroke
 * rises on hover, a pearl wash shows while pressed, focus is the gold border plus halo. No shadows.
 *
 *   <Card><Text variant="heading">Raj Niwas Palace</Text></Card>
 *   <Card tone="peacock" padding="lg">…</Card>
 *   <Card tone="flat" onPress={open} accessibilityLabel="Open Bagh Mahal Retreat">…</Card>
 */
export const Card: ForwardRefExoticComponent<CardProps & RefAttributes<ComponentRef<typeof View>>> =
  forwardRef<ComponentRef<typeof View>, CardProps>(function Card(
    { padding = "md", tone = "glass", blur = true, onPress, className, ...rest },
    ref,
  ) {
    const pressable = Boolean(onPress);
    return (
      <CardRoot
        ref={ref}
        tone={tone}
        blur={blur}
        onPress={onPress}
        className={cn(cardFrameStyles({ tone, padding, pressable }), className)}
        {...rest}
      />
    );
  });
