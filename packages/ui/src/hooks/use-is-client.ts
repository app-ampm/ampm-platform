import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False during server rendering and the hydration pass, true afterwards. Anything that depends on
 * the window (the breakpoint, the colour scheme) must not change the markup before hydration, or
 * React reports a mismatch on the web export (`web.output: "server"`).
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
