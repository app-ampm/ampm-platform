/**
 * @ampm/web-forms/testing: the fields' test helpers, for the site's own component tests too (reuse rule
 * 2). Markup as the server sends it, and a real DOM (a test file's `@vitest-environment jsdom`) for what
 * keyboards and screen readers depend on beyond the markup, such as where focus goes after a press. Tests
 * only: nothing in a page imports it.
 *
 *   // @vitest-environment jsdom
 *   import { mount, press, buttonNamed } from "@ampm/web-forms/testing";
 *
 *   const page = await mount(<RoomsSection … />);
 *   await press(buttonNamed(page.host, "Add a room category"));
 */
export { buttonNamed, byId, mount, press } from "./dom.test-utils";
export type { Mounted } from "./dom.test-utils";
export { markupOf, noop, tagsWith } from "./markup.test-utils";
