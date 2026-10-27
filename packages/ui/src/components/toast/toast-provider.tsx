import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { ToastViewport } from "./toast-viewport";
import type { ToastContextValue, ToastItem, ToastOptions } from "./toast.types";

const ToastContext = createContext<ToastContextValue | null>(null);

export const DEFAULT_TOAST_DURATION_MS = 4000;

export interface ToastProviderProps {
  readonly children: ReactNode;
  readonly dismissLabel?: string | undefined;
}

/**
 * Brief confirmations and non-blocking warnings. Mount once near the root; `useToast()` anywhere
 * below. Toasts are announced politely, dismiss on a timer or a tap, and stack newest first.
 */
export function ToastProvider({ children, dismissLabel }: ToastProviderProps) {
  const [items, setItems] = useState<readonly ToastItem[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      const id = nextId.current++;
      setItems((current) => [{ ...options, id }, ...current]);
      const duration = options.durationMs ?? DEFAULT_TOAST_DURATION_MS;
      if (duration > 0)
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), duration),
        );
      return id;
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} dismissLabel={dismissLabel} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) throw new Error("useToast() needs a <ToastProvider> above it");
  return context;
}
