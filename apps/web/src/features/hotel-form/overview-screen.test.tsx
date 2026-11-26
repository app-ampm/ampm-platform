import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT, EDITED_AT, draftView, draftWith } from "./draft.test-fixtures";
import { HOTEL_FORM_COPY } from "./hotel-form-copy";
import { momentOf } from "./hotel-form-time";
import { OVERVIEW_COPY } from "./overview-copy";
import { ME, buttonsIn, decoded, flowAt, overviewOf } from "./screen.test-utils";
import type { DraftView, MeView } from "./use-hotel-form-flow";

/* HF-04, the overview (D-190 §5; plan §4.4 and §8): where signing in lands. */

vi.mock("@/components/bot-check/use-bot-check", () => ({
  useBotCheck: () => ({
    ref: () => undefined,
    check: { status: "checking" },
    token: null,
    reset: () => undefined,
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
});

afterEach(() => vi.useRealTimers());

const loaded: MeView = { data: ME, isLoading: false, error: null, retry: () => undefined };
const overview = (draft: DraftView = draftView(), me: MeView = loaded) =>
  decoded(
    overviewOf(
      flowAt({ phase: { kind: "signed_in", reverify: null }, session: "s" }, { me, draft }),
    ),
  );

/** Each link of the page: where it goes, and its words. */
function linksIn(html: string): [string, string][] {
  return [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((match) => [
    match[1] ?? "",
    (match[2] ?? "").replace(/<[^>]+>/g, ""),
  ]);
}

describe("HF-04, the overview", () => {
  it("lists the seven sections in order, each a link with its status as a word", () => {
    const links = linksIn(overview()).filter(([href]) => href.startsWith("/hotel-form/sections/"));
    expect(links.map(([href]) => href)).toEqual([
      "/hotel-form/sections/fact_sheet_media",
      "/hotel-form/sections/property",
      "/hotel-form/sections/contact",
      "/hotel-form/sections/rooms",
      "/hotel-form/sections/venues",
      "/hotel-form/sections/booking_terms",
      "/hotel-form/sections/food_beverage",
      "/hotel-form/sections/fact_sheet_media",
    ]);
    const words = links.slice(1).map(([, text]) => text);
    expect(words[0]).toContain("Property and location");
    expect(words[0]).toContain("In progress");
    expect(words[1]).toContain("Complete");
    expect(words[3]).toContain("Not started");
    // The fact sheet counts as complete until its uploads arrive, but says Not started until opened.
    expect(words[6]).toContain("Not started");
  });

  it("says who saved each section last and when, and how many sections are done", () => {
    const html = overview();
    expect(html).toContain(`Last saved by Ravi Kumar ${momentOf(EDITED_AT)}`);
    expect(html).toContain("1 of 7 sections complete");
  });

  it("says you saved a section you saved last, told by person: not by a name a colleague may share", () => {
    const html = overview();
    expect(html).toContain(OVERVIEW_COPY.sections.lastSavedByYou(momentOf(EDITED_AT)));
    expect(html).not.toContain(`Last saved by Asha Rao`);
  });

  it("starts with Quick start, pointing to the fact sheet section, with no upload control yet", () => {
    const html = overview();
    expect(html).toContain(OVERVIEW_COPY.quickStart.heading);
    expect(html).toMatch(
      /<a [^>]*href="\/hotel-form\/sections\/fact_sheet_media"[^>]*>Go to the fact sheet section →<\/a>/,
    );
    expect(html).not.toContain('type="file"');
  });

  it("names who else is helping, and marks the person as you", () => {
    const html = overview();
    expect(html).toContain("Asha Rao (you) · General Manager");
    expect(html).toContain("Ravi Kumar · Director of Sales");
    expect(html).not.toContain(OVERVIEW_COPY.helpers.onlyYou);
    const alone = overview(draftView({ ...DRAFT, contributors: [DRAFT.contributors[0]!] }));
    expect(alone).toContain(OVERVIEW_COPY.helpers.onlyYou);
  });

  it("calls a person who withdrew their consent a colleague, naming them nowhere", () => {
    const unnamed = { fullName: null, designation: null, isYou: false };
    const sections = {
      ...DRAFT.sections,
      contact: { ...DRAFT.sections.contact, lastEditedBy: null, isLastSaveYours: false },
    };
    const html = overview(
      draftView({ ...DRAFT, sections, contributors: [DRAFT.contributors[0]!, unnamed] }),
    );
    expect(html).toContain(OVERVIEW_COPY.helpers.unnamed);
    expect(html).toContain(
      OVERVIEW_COPY.sections.lastSavedUnnamed(momentOf(DRAFT.sections.contact.lastEditedAt!)),
    );
    expect(html).not.toContain("null");
    expect(html).not.toContain(OVERVIEW_COPY.helpers.onlyYou);
  });

  it("leads on to Review and submit, the page's one gold action, while the form is open", () => {
    const html = overview();
    expect(linksIn(html)).toContainEqual(["/hotel-form/review", "Review and submit"]);
    expect(html.match(/bg-brand(?![\w/-])/g)?.length ?? 0).toBeGreaterThan(0);
    expect(buttonsIn(html)).toEqual(["Edit your details", "Sign out"]);
  });

  it("says when AMPM asked for changes", () => {
    const me = { ...ME, request: { ...ME.request, status: "changes_requested" as const } };
    const html = overview(draftView(draftWith({ status: "changes_requested" })), {
      ...loaded,
      data: me,
    });
    expect(html).toContain(OVERVIEW_COPY.changesRequested.heading);
    expect(html).toContain(OVERVIEW_COPY.changesRequested.body);
    expect(linksIn(html)).toContainEqual(["/hotel-form/review", "Review and submit"]);
  });

  it("says who submitted a locked request and when, leading to its status instead", () => {
    const me = { ...ME, request: { ...ME.request, status: "submitted" as const } };
    const draft = draftWith({
      status: "submitted",
      state: "locked",
      submittedBy: "Ravi Kumar",
      submittedAt: EDITED_AT,
    });
    const html = overview(draftView(draft), { ...loaded, data: me });
    expect(html).toContain(OVERVIEW_COPY.locked.submitted("Ravi Kumar", momentOf(EDITED_AT)));
    expect(linksIn(html)).toContainEqual(["/hotel-form/status", "See where your request stands"]);
    expect(linksIn(html).map(([href]) => href)).not.toContain("/hotel-form/review");
    expect(html).not.toContain(OVERVIEW_COPY.quickStart.heading);
  });

  it("says a merged request is complete", () => {
    const me = { ...ME, request: { ...ME.request, status: "merged" as const } };
    const html = overview(draftView(draftWith({ status: "merged", state: "status_only" })), {
      ...loaded,
      data: me,
    });
    expect(html).toContain(OVERVIEW_COPY.complete.heading);
  });

  it("shows the sections loading, and a failure with Try again, under the request", () => {
    const loading = overview({
      data: undefined,
      isLoading: true,
      error: null,
      retry: () => undefined,
    });
    expect(loading).toMatch(/role="status"[^>]*>Loading your sections…</);
    expect(loading).toContain("Seasonal refresh 2027");
    const failed = overview({
      data: undefined,
      isLoading: false,
      error: HOTEL_FORM_COPY.errors.network,
      retry: () => undefined,
    });
    expect(failed).toContain(HOTEL_FORM_COPY.errors.network);
    expect(buttonsIn(failed)).toEqual(["Try again", "Edit your details", "Sign out"]);
  });
});
