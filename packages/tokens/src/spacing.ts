/**
 * Spacing on the 4px scale (`p-2` = 8px, `gap-4` = 16px), in rem so the web honours the user's
 * font size; NativeWind inlines rem at 16 on native (apps/mobile/metro.config.js) so both platforms
 * agree. Arbitrary values are forbidden; a missing step is added here. Peacock Night adds the half
 * steps its mocks use: 6, 10 and 14 (gaps and chip padding), 18 (the phone gutter), 22 (checkboxes),
 * 26 (the floating tab bar's distance from the bottom), 30 (the workspace gutter beside the rail, T)
 * and 72 (the portal's desktop gutter, D and C).
 */
export const spacing = {
  "0": "0px",
  px: "1px",
  "0.5": "0.125rem",
  "1": "0.25rem",
  "1.5": "0.375rem",
  "2": "0.5rem",
  "2.5": "0.625rem",
  "3": "0.75rem",
  "3.5": "0.875rem",
  "4": "1rem",
  "4.5": "1.125rem",
  "5": "1.25rem",
  "5.5": "1.375rem",
  "6": "1.5rem",
  "6.5": "1.625rem",
  "7": "1.75rem",
  "7.5": "1.875rem",
  "8": "2rem",
  "9": "2.25rem",
  "10": "2.5rem",
  "11": "2.75rem",
  "12": "3rem",
  "14": "3.5rem",
  "16": "4rem",
  "18": "4.5rem",
  "20": "5rem",
  "24": "6rem",
  "28": "7rem",
  "32": "8rem",
  "36": "9rem",
  "40": "10rem",
  "48": "12rem",
  "56": "14rem",
  "64": "16rem",
  "72": "18rem",
  "80": "20rem",
  "96": "24rem",
} as const;

/**
 * Named sizes: the minimum touch target (44px: `min-h-touch`, `h-touch`, `w-touch`), the admin
 * workspace's navigation rail (232px: `w-rail`), the list column beside a detail (432px: `w-list`,
 * T6's 430 queue) and the desktop artboard frame (1440px: `max-w-frame`), which caps a portal page,
 * its gutters included, and the portal's top navigation on windows wider than the mocks.
 */
export const sizes = {
  touch: "2.75rem",
  rail: "14.5rem",
  list: "27rem",
  frame: "90rem",
} as const;

/**
 * The spacing steps in pixels (rem at 16, as NativeWind inlines it), for the layout maths a class
 * cannot express, such as a safe-area inset plus a gap: `insets.bottom + spacingPx["6.5"]`.
 */
export const spacingPx = Object.fromEntries(
  Object.entries(spacing).map(([step, value]) => [
    step,
    value.endsWith("rem") ? Number.parseFloat(value) * 16 : Number.parseFloat(value),
  ]),
) as Record<keyof typeof spacing, number>;
