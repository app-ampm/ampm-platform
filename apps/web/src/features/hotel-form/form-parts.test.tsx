import { renderToStaticMarkup } from "react-dom/server";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WaitButton } from "./form-parts";
import { buttonsIn, tagsWith } from "./screen.test-utils";

/* A button the API's Retry-After holds back (D-189 §3): Continue, Save, Send me a code. */

const NOW = Date.parse("2026-11-25T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

const button = (retryAt: number | null, isBusy = false) =>
  renderToStaticMarkup(
    <WaitButton type="submit" retryAt={retryAt} isBusy={isBusy} words="Save" busyWords="Saving…" />,
  );

describe("WaitButton", () => {
  it("counts the wait down in its words, held back until the wait is over", () => {
    const html = button(NOW + 30_000);
    expect(buttonsIn(html)).toEqual(["Try again in 0:30"]);
    expect(tagsWith(html, "button", 'type="submit"')[0]).toContain('disabled=""');
  });

  it("says its own words with no wait, or once the wait is over, and says it is busy", () => {
    expect(buttonsIn(button(null))).toEqual(["Save"]);
    expect(buttonsIn(button(NOW - 1_000))).toEqual(["Save"]);
    expect(tagsWith(button(null), "button", 'type="submit"')[0]).not.toContain('disabled=""');
    expect(buttonsIn(button(null, true))).toEqual(["Saving…"]);
  });
});
