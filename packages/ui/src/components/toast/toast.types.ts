import type { StatusTone } from "../status-chip/status-chip.styles";

export type ToastTone = Exclude<StatusTone, "brand">;

export interface ToastOptions {
  readonly title: string;
  readonly description?: string | undefined;
  readonly tone?: ToastTone | undefined;
  /** 0 keeps the toast until dismissed. */
  readonly durationMs?: number | undefined;
  readonly action?: { readonly label: string; readonly onPress: () => void } | undefined;
}

export interface ToastItem extends ToastOptions {
  readonly id: number;
}

export interface ToastContextValue {
  /** Shows a toast and returns its id. */
  readonly show: (options: ToastOptions) => number;
  readonly dismiss: (id: number) => void;
}
