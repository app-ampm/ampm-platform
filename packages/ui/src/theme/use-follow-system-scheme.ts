import type { ThemePreference } from "./theme.types";

/**
 * Native: nothing to do. With preference "system", NativeWind resolves the scheme through React
 * Native's Appearance API itself, for the `dark` selectors and for `useColorScheme()` alike.
 * The web build has its own implementation (use-follow-system-scheme.web.ts).
 */
export function useFollowSystemScheme(_preference: ThemePreference): void {}
