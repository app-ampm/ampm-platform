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

export * from "@testing-library/react-native";
