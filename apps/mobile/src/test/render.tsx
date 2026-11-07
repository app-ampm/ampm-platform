import { fireEvent, render, screen, type RenderOptions } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";

import { ThemeProvider, ToastProvider, uiCopy } from "@ampm/ui";

function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider initialPreference="light">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

/**
 * Renders a screen under the providers the app mounts in `_layout.tsx` (theme, toasts). A screen that
 * also needs API data renders through `renderWithApi` (./api), which adds the `ApiProvider`.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { wrapper: Providers, ...options });
}

/**
 * Closes every toast on screen. A toast dismisses itself after four seconds, and that timer would keep
 * Jest's event loop alive after the run (the worker then has to be forced to exit); dismissing a toast
 * clears its timer. Call it at the end of a test that raised one.
 */
export async function dismissToasts(): Promise<void> {
  for (const button of screen.queryAllByRole("button", { name: uiCopy.dismiss })) {
    await fireEvent.press(button);
  }
}

export * from "@testing-library/react-native";
