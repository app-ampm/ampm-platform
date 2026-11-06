/**
 * Spacing on the 4px scale (`p-2` = 8px, `gap-4` = 16px), in rem so the web honours the user's
 * font size; NativeWind inlines rem at 16 on native (apps/mobile/metro.config.js) so both platforms
 * agree. Arbitrary values are forbidden; a missing step is added here. Peacock Night adds the half
 * steps its mocks use: 6, 10 and 14 (gaps and chip padding), 18 (the phone gutter) and 22 (checkboxes).
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
  "7": "1.75rem",
  "8": "2rem",
  "9": "2.25rem",
  "10": "2.5rem",
  "11": "2.75rem",
  "12": "3rem",
  "14": "3.5rem",
  "16": "4rem",
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
 * Named sizes: the minimum touch target (44px: `min-h-touch`, `h-touch`, `w-touch`) and the admin
 * workspace's navigation rail (232px: `w-rail`).
 */
export const sizes = {
  touch: "2.75rem",
  rail: "14.5rem",
} as const;
