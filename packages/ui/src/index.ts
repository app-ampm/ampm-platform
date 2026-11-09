/**
 * @ampm/ui: universal components and UI-only hooks on React Native primitives, react-native-web
 * and NativeWind, styled with @ampm/tokens classes only (.claude/rules/ui.md). The components are the
 * Peacock Night kit (docs/design/peacock-night.md §6); the website takes the same class recipes,
 * without React Native, from `@ampm/ui/styles`.
 */
export const UI_VERSION = "1.0.0";

export { cn } from "./lib/cn";
export type { ClassValue } from "./lib/cn";
export { variants } from "./lib/variants";
export { isHiddenFromVoiceOver } from "./lib/accessibility-hidden";
export type { VoiceOverHiding } from "./lib/accessibility-hidden";
export type { VariantProps } from "./lib/variants";
export { AnimatedView } from "./lib/animated-view";

export { ThemeProvider, useTheme } from "./theme/theme-provider";
export type { ThemeProviderProps } from "./theme/theme-provider";
export type { ThemePreference, ResolvedTheme, ThemeContextValue } from "./theme/theme.types";

export { useBreakpoint, breakpointFor } from "./hooks/use-breakpoint";
export type { Breakpoint, BreakpointInfo } from "./hooks/use-breakpoint";
export { useReducedMotion } from "./hooks/use-reduced-motion";
export { useGlassBlur } from "./hooks/use-glass-blur";
export { useIsClient } from "./hooks/use-is-client";
export { announcementText, useAnnounce } from "./hooks/use-announce";
export { uiCopy } from "./copy";

// Foundations: type, glass, the glow behind a screen, icons, layout.
export * from "./components/text";
export * from "./components/glass-panel";
export * from "./components/glow-backdrop";
export * from "./components/icon";
export * from "./components/layout";

// Actions and selection.
export * from "./components/button";
export * from "./components/link";
export * from "./components/filter-chip";
export * from "./components/segmented-control";

// Forms.
export * from "./components/input";
export * from "./components/otp-input";
export * from "./components/toggle";
export * from "./components/checkbox";
export * from "./components/select";

// Status and progress.
export * from "./components/status-chip";
export * from "./components/badge";
export * from "./components/progress-bar";
export * from "./components/stepper";

// Surfaces and content.
export * from "./components/card";
export * from "./components/list-item";
export * from "./components/data-table";
export * from "./components/load-more";
export * from "./components/internal-panel";
export * from "./components/stat";
export * from "./components/avatar";
export * from "./components/money-text";
export * from "./components/photo-placeholder";
export * from "./components/image";

// Feedback: notices, loading, full-area states, overlays.
export * from "./components/callout";
export * from "./components/offline-banner";
export * from "./components/skeleton";
export * from "./components/state-view";
export * from "./components/empty-state";
export * from "./components/error-state";
export * from "./components/offline-state";
export * from "./components/query-error-state";
export * from "./components/section-error";
export * from "./components/sheet";
export * from "./components/confirm-sheet";
export * from "./components/toast";

// Screen scaffold and navigation.
export * from "./components/screen";
export * from "./components/screen-header";
export * from "./components/tab-bar";
export * from "./components/nav-rail";

export { allStories, defineStories } from "./stories";
export type { Story, StoryModule } from "./stories";
export { Gallery } from "./gallery";
export type { GalleryProps } from "./gallery";
