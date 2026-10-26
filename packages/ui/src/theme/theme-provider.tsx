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
import { useFollowSystemScheme } from "./use-follow-system-scheme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly children: ReactNode;
  /** Initial preference; the app passes the stored one once persistence exists. */
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
  initialPreference = "system",
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

  const resolved: ResolvedTheme = colorScheme === "dark" ? "dark" : "light";

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
