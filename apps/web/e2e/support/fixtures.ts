import AxeBuilder from "@axe-core/playwright";
import { expect, test as base, type Page } from "@playwright/test";

import { createTestLink, revokeTestLink, type TestLink } from "./local-api";

/*
 * The hotel form's test fixtures: a fresh test request per test (revoked afterwards), Cloudflare
 * Turnstile stood in for by a script that passes at once and records what each widget was drawn with,
 * and an axe check of the page as it stands.
 */

/**
 * Turnstile's explicit-render API, answering every widget with a token a moment after it is drawn or
 * reset. It is served at Turnstile's own address, so the page's CSP (script-src) is exercised as for the
 * real script; the API's stub bot check accepts any token, as Cloudflare's always-pass test key's would.
 */
const TURNSTILE_STUB = `(() => {
  const widgets = new Map();
  let issued = 0;
  const pass = (id) => setTimeout(() => {
    const options = widgets.get(id);
    issued += 1;
    if (options) options.callback("e2e-turnstile-token-" + issued);
  }, 50);
  window.__turnstileRenders = [];
  window.turnstile = {
    render(container, options) {
      const id = "e2e-widget-" + (widgets.size + 1) + "-" + Date.now();
      widgets.set(id, options);
      window.__turnstileRenders.push({ action: options.action ?? null, sitekey: options.sitekey });
      const element = typeof container === "string" ? document.querySelector(container) : container;
      if (element) element.textContent = "Security check (e2e stand-in)";
      pass(id);
      return id;
    },
    reset(id) { pass(id); },
    remove(id) { widgets.delete(id); },
  };
})();`;

/** Stands Turnstile in on a page, before anything loads. */
export async function standInTurnstile(page: Page): Promise<void> {
  await page.route("https://challenges.cloudflare.com/turnstile/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: TURNSTILE_STUB }),
  );
}

declare global {
  interface Window {
    /** What the stand-in drew each widget with (TURNSTILE_STUB). */
    __turnstileRenders?: { readonly action: string | null; readonly sitekey: string }[];
  }
}

/** The actions the page drew Turnstile widgets with. */
export async function turnstileActions(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() => (window.__turnstileRenders ?? []).map((render) => render.action));
}

/**
 * The page passes axe (WCAG 2.1 A and AA, and best practice) as it stands, once its transitions have
 * finished: a button turning gold as it is enabled would otherwise be measured halfway.
 */
export async function expectAccessible(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== "running"),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  const found = results.violations.flatMap((violation) =>
    violation.nodes.map(
      (node) => `${violation.id} at ${node.target.join(" ")}: ${node.failureSummary}`,
    ),
  );
  expect(found).toEqual([]);
}

export const test = base.extend<{ formLink: TestLink }>({
  page: async ({ page }, provide) => {
    await standInTurnstile(page);
    await provide(page);
  },
  // Playwright reads a fixture's needs from its first parameter, which must be a destructuring pattern.
  // eslint-disable-next-line no-empty-pattern
  formLink: async ({}, provide) => {
    const link = await createTestLink();
    await provide(link);
    await revokeTestLink(link.id);
  },
});

export { expect };
