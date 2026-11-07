import type { StatusTone } from "../status-chip/status-chip.styles";

export type ToastTone = Exclude<StatusTone, "brand">;

export interface ToastOptions {
  readonly title: string;
  readonly description?: string | undefined;
  readonly tone?: ToastTone | undefined;
  /**
   * How long it stays, in milliseconds; 0 keeps it until dismissed. Defaults to 4 seconds, or until
   * dismissed when it has an action, so its action can be reached by keyboard and screen reader.
   */
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
