/**
 * Breakpoints, mobile first. Below `md` is a phone; `md` a tablet or a narrow window; `lg` a
 * tablet in landscape or a desktop. `md:` and `lg:` classes on web, `useBreakpoint()` from
 * packages/ui on native, both from these numbers.
 */
export const breakpoints = {
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof breakpoints;
