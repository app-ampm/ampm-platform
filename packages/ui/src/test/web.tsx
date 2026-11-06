import { act, type ReactElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { ToastProvider } from "../components/toast";
import { ThemeProvider } from "../theme/theme-provider";

/**
 * Rendering for the `web` Jest project (`*.web.test.tsx`): the component goes through react-native-web
 * into jsdom, so a test reads the DOM a browser gets (roles, ARIA attributes, elements) and sends it
 * real keyboard events. NativeWind classes are not applied here; class recipes are tested natively.
 *
 *   const { container } = await renderOnWeb(<Toggle value label="Remember this device" onValueChange={set} />);
 *   expect(byRole(container, "switch").getAttribute("aria-checked")).toBe("true");
 */

// React flushes effects inside act() only when it is told it runs under a test.
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <ThemeProvider initialPreference="light">
      <ToastProvider>{children}</ToastProvider>
    </ThemeProvider>
  );
}

export interface WebRender {
  /** The element React renders into, attached to document.body. */
  readonly container: HTMLElement;
  readonly rerender: (ui: ReactElement) => Promise<void>;
  readonly unmount: () => Promise<void>;
}

const mounted = new Set<() => Promise<void>>();

/** Renders under the same providers as `renderWithProviders`, through react-native-web. */
export async function renderOnWeb(ui: ReactElement): Promise<WebRender> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  const draw = async (next: ReactElement) => {
    await act(async () => root.render(<Providers>{next}</Providers>));
  };
  const unmount = async () => {
    mounted.delete(unmount);
    await act(async () => root.unmount());
    container.remove();
  };
  mounted.add(unmount);
  await draw(ui);
  return { container, rerender: draw, unmount };
}

// Every render is unmounted after its test, as Testing Library does on native.
afterEach(async () => {
  for (const unmount of [...mounted]) await unmount();
});

/** The one element with this role; fails the test when there is none or more than one. */
export function byRole(container: ParentNode, role: string): HTMLElement {
  const found = container.querySelectorAll<HTMLElement>(`[role="${role}"]`);
  if (found.length !== 1) throw new Error(`Expected one [role="${role}"], found ${found.length}`);
  const [element] = found;
  if (!element) throw new Error(`No [role="${role}"]`);
  return element;
}

/** Every element with this role, in document order. */
export function allByRole(container: ParentNode, role: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>(`[role="${role}"]`)];
}

/**
 * A key pressed and released on the element, as a keyboard user does. Returns the keydown event: its
 * `defaultPrevented` says whether the browser's own action (Space scrolls the page) was stopped.
 */
export async function pressKey(target: Element, key: string): Promise<KeyboardEvent> {
  const down = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  await act(async () => {
    target.dispatchEvent(down);
    target.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true, cancelable: true }));
  });
  return down;
}

export { act };
