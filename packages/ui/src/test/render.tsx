import { render, type RenderOptions } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

import { ToastProvider } from "../components/toast";
import { ThemeProvider } from "../theme/theme-provider";

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialPreference="light">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

/** Renders under the providers every component expects (theme, toasts). */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

/**
 * The class list of a recipe or a rendered className, to match whole classes (`toContain("bg-brand")`
 * never passes on `bg-brand/14`). Anything but a string, such as a missing prop, is an empty list.
 */
export function classes(value: unknown): readonly string[] {
  return typeof value === "string" ? value.split(/\s+/) : [];
}

export * from "@testing-library/react-native";
