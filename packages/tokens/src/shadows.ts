/**
 * Elevation. One layer per level so React Native (which draws a single shadow) and the web
 * render the same shape; the level names follow Tailwind so `shadow-md` means the same on both.
 */
export const shadows = {
  none: "none",
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.06)",
  DEFAULT: "0 2px 4px 0 rgb(0 0 0 / 0.08)",
  md: "0 4px 8px -2px rgb(0 0 0 / 0.10)",
  lg: "0 12px 24px -6px rgb(0 0 0 / 0.14)",
} as const;
