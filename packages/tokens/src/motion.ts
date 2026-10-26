/**
 * Motion. Durations and easings are the same numbers on both platforms: CSS transitions on web
 * (`duration-base ease-standard`), Reanimated on native (`motionMs`, `motionBezier`).
 * Reduced motion is respected by the components, not here.
 */
export const duration = {
  instant: "0ms",
  fast: "120ms",
  DEFAULT: "200ms",
  base: "200ms",
  slow: "320ms",
} as const;

export const easing = {
  DEFAULT: "cubic-bezier(0.2, 0, 0, 1)",
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  decelerate: "cubic-bezier(0, 0, 0, 1)",
  accelerate: "cubic-bezier(0.3, 0, 1, 1)",
} as const;

/** The durations as numbers, for Reanimated's `withTiming`. */
export const motionMs = {
  instant: 0,
  fast: 120,
  base: 200,
  slow: 320,
} as const;

/** The easings as control points, for Reanimated's `Easing.bezier`. */
export const motionBezier = {
  standard: [0.2, 0, 0, 1],
  decelerate: [0, 0, 0, 1],
  accelerate: [0.3, 0, 1, 1],
} as const;
