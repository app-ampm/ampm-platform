/**
 * @ampm/ui: universal components and UI-only hooks on React Native primitives, react-native-web
 * and NativeWind, styled with @ampm/tokens classes only (.claude/rules/ui.md).
 */
export const UI_VERSION = "0.1.0";

export { cn } from "./lib/cn";
export type { ClassValue } from "./lib/cn";
export { variants } from "./lib/variants";
export type { VariantProps } from "./lib/variants";
export { ThemeProvider, useTheme } from "./theme/theme-provider";
export type { ThemeProviderProps } from "./theme/theme-provider";
export type { ThemePreference, ResolvedTheme, ThemeContextValue } from "./theme/theme.types";
