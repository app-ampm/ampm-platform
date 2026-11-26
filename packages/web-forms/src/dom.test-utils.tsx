import { act, type ReactElement } from "react";
import { createRoot } from "react-dom/client";

/*
 * The fields in a real DOM (jsdom, a test file's `@vitest-environment jsdom`): what keyboards and screen
 * readers depend on beyond the markup, such as where focus goes after a press. Imported by tests only.
 */

// React flushes its effects inside act() only when the environment says it is a test.
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

export interface Mounted {
  readonly host: HTMLElement;
  readonly unmount: () => void;
}

/** Renders an element into a fresh host in the document, its effects flushed. */
export async function mount(element: ReactElement): Promise<Mounted> {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return {
    host,
    unmount: () => {
      act(() => root.unmount());
      host.remove();
    },
  };
}

/** The element with this id, which the test expects to exist. */
export function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) throw new Error(`No element #${id}`);
  return element;
}

/** The button whose words are `text`, which the test expects to exist. */
export function buttonNamed(host: HTMLElement, text: string): HTMLButtonElement {
  const button = [...host.querySelectorAll("button")].find((each) => each.textContent === text);
  if (button === undefined) throw new Error(`No button "${text}"`);
  return button;
}

/** Presses an element as a click does, its effects flushed. */
export async function press(element: HTMLElement): Promise<void> {
  await act(async () => element.click());
}
