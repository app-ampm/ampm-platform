import { useEffect } from "react";

import type { ThemePreference } from "./theme.types";

const DARK_CLASS = "dark";

/**
 * Web: Tailwind's class strategy means the page is dark only when `dark` is on <html>. NativeWind
 * sets that class for an explicit "dark" and removes it for "light" and "system", so following the
 * operating system is the app's job: mirror `prefers-color-scheme` onto <html> while the preference
 * is "system", and keep mirroring it when the system changes.
 */
export function useFollowSystemScheme(preference: ThemePreference): void {
  useEffect(() => {
    if (preference !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle(DARK_CLASS, media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
}
