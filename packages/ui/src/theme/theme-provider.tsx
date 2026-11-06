import { colorScheme as nativewindScheme, useColorScheme } from "nativewind";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type { ResolvedTheme, ThemeContextValue, ThemePreference } from "./theme.types";
import { useIsClient } from "../hooks/use-is-client";
import { useFollowSystemScheme } from "./use-follow-system-scheme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Initial preference. Peacock Night is dark only, so the default is dark and the schemes are identical. */
  readonly initialPreference?: ThemePreference;
  /** Called when the user changes the preference, so the app can store it. */
  readonly onPreferenceChange?: (preference: ThemePreference) => void;
}

/**
 * Dark mode is a variable swap (styling.md): the tokens' preset puts the light values on `:root`
 * and the dark ones on `.dark:root`, and Tailwind runs with darkMode "class". NativeWind owns the
 * switch (`colorScheme.set`): on native it drives the `dark` selectors through Appearance, on web
 * it toggles the `dark` class on <html>. This provider wraps that switch in a preference
 * (light, dark or system) and a React context.
 *
 * The web build is server-rendered: the server renders light and the class is applied after
 * hydration, so text that names the scheme must wait for the client (see apps/mobile/src/app/index.tsx).
 */
export function ThemeProvider({
  children,
  initialPreference = "dark",
  onPreferenceChange,
}: ThemeProviderProps) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    nativewindScheme.set(preference);
  }, [preference]);
  useFollowSystemScheme(preference);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      onPreferenceChange?.(next);
    },
    [onPreferenceChange],
  );

  // The server renders light and so does the hydration pass; the real scheme applies right after, so
  // colours resolved in JavaScript (icons, spinners) never disagree with the server-rendered markup.
  const isClient = useIsClient();
  const resolved: ResolvedTheme = isClient && colorScheme === "dark" ? "dark" : "light";

  const toggle = useCallback(() => {
    setPreference(resolved === "dark" ? "light" : "dark");
  }, [resolved, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolved, setPreference, toggle }),
    [preference, resolved, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error("useTheme() needs a <ThemeProvider> above it");
  return context;
}
