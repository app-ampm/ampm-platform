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
 * also needs API data wraps its element in an `<ApiProvider>` before passing it here.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from "@testing-library/react-native";
