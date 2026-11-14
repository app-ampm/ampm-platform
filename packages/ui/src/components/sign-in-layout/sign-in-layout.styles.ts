import type { GlowVariant } from "../glow-backdrop";
import type { Gap } from "../layout";
import type { SignInLayoutMode } from "./use-sign-in-layout-mode";

/**
 * The page is one tree at every width (so the form never remounts and keeps what was typed); each
 * arrangement only swaps these classes. phone: P1 · card: one centred glass card from 768 · split:
 * D1 from 1024.
 */
type ByMode<T> = Readonly<Record<SignInLayoutMode, T>>;

/**
 * The orbs per arrangement. P1 and the centred card keep the hero glow. D1 wants gold behind the
 * headline and peacock low at the right; no variant draws that yet (new placements wait on the glow
 * decision), so the split takes `corners`, which puts its orbs in D1's two places with the tones the
 * other way round.
 */
export const signInGlow: ByMode<GlowVariant> = { phone: "top", card: "top", split: "corners" };

/**
 * The screen's column. The centred card sits in the middle of the canvas. D1 runs its two columns
 * edge to edge over the 1440 frame, so the screen's own gutters give way to the columns' padding.
 */
export const signInContentStyles: ByMode<string> = {
  phone: "",
  card: "grow items-center justify-center",
  split: "grow lg:max-w-frame lg:self-center lg:p-0",
};

/** Around both columns: the centred glass card from 768 (its glass is drawn only there). */
export const signInFrameStyles: ByMode<string> = {
  phone: "",
  card: "w-full max-w-md md:p-9",
  split: "grow",
};

/** Between the headline and the form: the phone's 16, the centred card's 24, none beside each other. */
export const signInColumnsGap: ByMode<Gap> = { phone: 4, card: 6, split: 0 };

/**
 * The headline column: the wordmark 32 over the headline; in D1, 56 above and below and 72 at the
 * sides, with the foot eyebrow, spread over at least the visible height (a style: the window's).
 */
export const signInHeroColumnStyles: ByMode<string> = {
  phone: "flex-col gap-8",
  card: "flex-col gap-8",
  split: "flex-col justify-between gap-12 lg:px-18 lg:py-14",
};

/** The form column: the form card, then the aside; in D1, 56 around and centred in the visible height. */
export const signInFormColumnStyles: ByMode<string> = {
  phone: "flex-col gap-4",
  card: "flex-col gap-6",
  split: "flex-col items-center justify-center gap-6 lg:p-14",
};

/**
 * The form card: glass on a phone; bare inside the centred card; in D1 512 wide (D1 520), 44 padding
 * and radius 28 (D1's 36 is past the largest radius token, `2xl`).
 */
export const signInFormCardStyles: ByMode<string> = {
  phone: "",
  card: "",
  split: "w-full max-w-lg lg:rounded-2xl lg:p-11",
};

/** The card's title over the form: an eyebrow 12 above it, or D1's Gilda 36 title 24 above it. */
export const signInCardBodyGap: ByMode<Gap> = { phone: 3, card: 3, split: 6 };

/** What follows the card: blocks 16 apart (24 inside the centred card), the card's width in D1. */
export const signInAsideGap: ByMode<Gap> = { phone: 4, card: 6, split: 4 };
export const signInAsideStyles: ByMode<string> = { phone: "", card: "", split: "w-full max-w-lg" };

/** D1's foot eyebrow: 11px at 0.16em, wider and looser than a section eyebrow. */
export const signInFootnoteStyles = "text-xs tracking-label";
