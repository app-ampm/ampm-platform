/**
 * @ampm/ui/styles: the kit's class recipes without React or React Native, for the public website
 * (plain Next.js DOM with `@ampm/tokens/tailwind.preset.web`, which defines the `web:` variant). The
 * components style themselves with these same recipes, so a website <button> and the app's Button
 * match. Recipes that lay out children carry `flex`, because a DOM element is a block by default.
 *
 * This file imports only `*.styles.ts` files and `src/lib/*`; src/styles.test.ts walks the whole
 * import graph and fails if React or React Native is ever reached.
 *
 *   import { buttonLabelStyles, buttonStyles, cn, glassStyles, calloutStyles } from "@ampm/ui/styles";
 *
 *   <a href="/demo" className={buttonStyles({ variant: "primary" })}>
 *     <span className={buttonLabelStyles({ variant: "primary" })}>Request a demo</span>
 *   </a>
 *   <aside className={cn(glassStyles({ recipe: "gold" }), calloutStyles)}>…</aside>
 */
export { cn } from "./lib/cn";
export type { ClassValue } from "./lib/cn";
export { variants } from "./lib/variants";
export type { VariantProps } from "./lib/variants";

// Type: Gilda Display for display sizes (one weight), Manrope for everything else.
export { DEFAULT_TONE, SINGLE_WEIGHT_VARIANTS, textStyles } from "./components/text/text.styles";
export type {
  TextAlign,
  TextStyleProps,
  TextTone,
  TextVariant,
  TextWeight,
} from "./components/text/text.styles";

// Glass, flat tints, the internal panel and the focus halo.
export {
  flatTintStyles,
  focusRingStyles,
  glassRecipes,
  glassStyles,
  groupFocusRingStyles,
  internalPanelStyles,
} from "./components/glass-panel/glass-panel.styles";
export type { GlassRecipeName, GlassStyleProps } from "./components/glass-panel/glass-panel.styles";
export { dividerStyles } from "./components/layout/layout.styles";
export type { DividerOrientation } from "./components/layout/layout.styles";

// Actions and selection.
export { buttonLabelStyles, buttonStyles } from "./components/button/button.styles";
export type {
  ButtonLabelStyleProps,
  ButtonSize,
  ButtonVariant,
} from "./components/button/button.styles";
export { linkLabelStyles, linkStyles } from "./components/link/link.styles";
export type { LinkLabelStyleProps, LinkTone, LinkVariant } from "./components/link/link.styles";
export {
  filterChipLabelStyles,
  filterChipStyles,
} from "./components/filter-chip/filter-chip.styles";
export type { FilterChipStyleProps } from "./components/filter-chip/filter-chip.styles";
export {
  segmentLabelStyles,
  segmentStyles,
  segmentedTrackStyles,
} from "./components/segmented-control/segmented-control.styles";
export type {
  SegmentLabelState,
  SegmentedControlSize,
} from "./components/segmented-control/segmented-control.styles";

// Forms.
export {
  fieldAffixStyles,
  fieldDividerStyles,
  fieldErrorStyles,
  fieldHelpStyles,
  fieldLabelStyles,
  fieldPrefixTextStyles,
  fieldStyles,
  fieldTextStyles,
} from "./components/input/input.styles";
export type { FieldState, FieldStyleProps, InputSize } from "./components/input/input.styles";
export {
  checkboxBoxStyles,
  checkboxRowStyles,
  checkboxTextStyles,
} from "./components/checkbox/checkbox.styles";

// Status and progress.
export {
  chipDotStyles,
  chipStyles,
  chipTextStyles,
} from "./components/status-chip/status-chip.styles";
export type {
  ChipSize,
  ChipStyleProps,
  StatusTone,
} from "./components/status-chip/status-chip.styles";
export { badgeLabelStyles, badgeStyles } from "./components/badge/badge.styles";
export type { BadgeTone } from "./components/badge/badge.styles";
export {
  progressFillStyles,
  progressSegmentStyles,
  progressSegmentsStyles,
  progressTrackStyles,
} from "./components/progress-bar/progress-bar.styles";
export type {
  ProgressBarSize,
  ProgressBarTone,
} from "./components/progress-bar/progress-bar.styles";
export {
  stepConnectorStyles,
  stepCurrentDotStyles,
  stepMarkerStyles,
  stepperStyles,
} from "./components/stepper/stepper.styles";
export type {
  StepConnectorState,
  StepState,
  StepperOrientation,
} from "./components/stepper/stepper.styles";

// Surfaces and content.
export { cardStyles } from "./components/card/card.styles";
export type { CardPadding, CardStyleOptions, CardTone } from "./components/card/card.styles";
export { listItemStyles } from "./components/list-item/list-item.styles";
export type { ListItemTone } from "./components/list-item/list-item.styles";
export { statStyles, statValueSize } from "./components/stat/stat.styles";
export type { StatAlign, StatSize } from "./components/stat/stat.styles";
export { avatarGroupStyles, avatarStyles, initialsOf } from "./components/avatar/avatar.styles";
export type { AvatarSize, AvatarTone } from "./components/avatar/avatar.styles";

// Feedback: notices, loading and full-area states.
export { calloutStyles } from "./components/callout/callout.styles";
export {
  offlineBannerDotStyles,
  offlineBannerStyles,
} from "./components/offline-banner/offline-banner.styles";
export { shimmerStyles, skeletonStyles } from "./components/skeleton/skeleton.styles";
export type { SkeletonShape } from "./components/skeleton/skeleton.styles";
export { stateIconStyles, stateViewStyles } from "./components/state-view/state-view.styles";
