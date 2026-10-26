/**
 * @ampm/ui: universal components and UI-only hooks on React Native primitives, react-native-web
 * and NativeWind, styled with @ampm/tokens classes only (.claude/rules/ui.md).
 */
export const UI_VERSION = "0.2.0";

export { cn } from "./lib/cn";
export type { ClassValue } from "./lib/cn";
export { variants } from "./lib/variants";
export type { VariantProps } from "./lib/variants";

export { ThemeProvider, useTheme } from "./theme/theme-provider";
export type { ThemeProviderProps } from "./theme/theme-provider";
export type { ThemePreference, ResolvedTheme, ThemeContextValue } from "./theme/theme.types";

export { useBreakpoint, breakpointFor } from "./hooks/use-breakpoint";
export type { Breakpoint, BreakpointInfo } from "./hooks/use-breakpoint";
export { useReducedMotion } from "./hooks/use-reduced-motion";
export { useIsClient } from "./hooks/use-is-client";
export { uiCopy } from "./copy";

export * from "./components/text";
export * from "./components/icon";
export * from "./components/layout";
export * from "./components/skeleton";
export * from "./components/button";
export * from "./components/input";
export * from "./components/card";
export * from "./components/link";
export * from "./components/image";
export * from "./components/status-chip";
export * from "./components/callout";
export * from "./components/money-text";
export * from "./components/sheet";
export * from "./components/toast";
export * from "./components/state-view";
export * from "./components/empty-state";
export * from "./components/error-state";
export * from "./components/offline-state";

export { allStories, defineStories } from "./stories";
export type { Story, StoryModule } from "./stories";
export { Gallery } from "./gallery";
