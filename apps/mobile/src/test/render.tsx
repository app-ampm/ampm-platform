import { render, type RenderOptions } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

import { ThemeProvider, ToastProvider } from "@ampm/ui";

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialPreference="light">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

/**
 * Renders a screen under the providers the app mounts in `_layout.tsx` (theme, toasts). A screen that
 * also needs API data renders through `renderWithApi` (./api), which adds the `ApiProvider`. A toast
 * left on screen needs no dismissing: the cleanup after each test unmounts the providers, and the
 * toast provider clears its timers as it goes.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react-native";
