/** The user's choice; "system" follows the device. */
export type ThemePreference = "light" | "dark" | "system";
/** What is on screen now. */
export type ResolvedTheme = "light" | "dark";

export interface ThemeContextValue {
  readonly preference: ThemePreference;
  readonly resolved: ResolvedTheme;
  readonly setPreference: (preference: ThemePreference) => void;
  readonly toggle: () => void;
}
