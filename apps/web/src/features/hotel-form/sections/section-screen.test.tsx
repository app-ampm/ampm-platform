import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { HotelFormDraftView, HotelFormSectionKey } from "@ampm/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DRAFT, EDITED_AT, draftWith } from "../draft.test-fixtures";
import { HOTEL_FORM_COPY } from "../hotel-form-copy";
import { momentOf, timeOfDay } from "../hotel-form-time";
import { OVERVIEW_COPY } from "../overview-copy";
import { buttonsIn, decoded, tagsWith } from "../screen.test-utils";
import { SECTIONS_COPY } from "../sections-copy";
import { editorAt } from "./editor.test-utils";
import { ROOMS_MODEL, roomsId } from "./rooms.form";
import { RoomsSection } from "./rooms-section";
import type { SaveState } from "./section-autosave";
import { SectionScreen } from "./section-screen";
import type { RefreshNote, SectionEditor } from "./use-section-editor";

/* HF-05's frame around every section (D-190 §5): the save line, a colleague's save, a locked request, refreshes. */

const NOW = Date.parse("2026-11-26T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => vi.useRealTimers());

const ROOMS = ROOMS_MODEL.fieldsOf(
  { totalRooms: 41, rows: [{ rowId: "0192f3a0-7d3e-4b1a-9c2f-000000000001", name: "Deluxe" }] },
  () => "unused",
);

function screen<F extends RefreshNote>(
  editor: SectionEditor<F>,
  draft: HotelFormDraftView = DRAFT,
  key: HotelFormSectionKey = "rooms",
  body: ReactNode = <p>Questions</p>,
): string {
  return decoded(
    renderToStaticMarkup(
      <SectionScreen sectionKey={key} draft={draft} editor={editor} reverify={null}>
        {body}
      </SectionScreen>,
    ),
  );
}

const saveLine = (save: SaveState<"rooms">, overrides: Partial<SectionEditor<typeof ROOMS>> = {}) =>
  /<p role="status" aria-live="polite"[^>]*>([^<]*)<\/p>/.exec(
    screen(editorAt(ROOMS, { save, ...overrides })),
  )?.[1];

describe("a section's page", () => {
  it("says where it sits among the seven, under the section's title and lead", () => {
    const html = screen(editorAt(ROOMS));
    expect(html).toContain("Section 3 of 7");
    expect(html).toMatch(/<h1 [^>]*>Rooms<\/h1>/);
    expect(html).toContain("Each kind of room, suite, villa or tent");
  });

  it("leads back to the overview and on to the next section, the last to Review and submit", () => {
    const links = (html: string) =>
      [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g)].map((m) => [
        m[1],
        m[2]?.replace(/<[^>]+>/g, ""),
      ]);
    expect(links(screen(editorAt(ROOMS)))).toEqual([
      ["/hotel-form/overview", "Back to the overview"],
      ["/hotel-form/sections/venues", "Next: Venues"],
    ]);
    expect(
      links(screen(editorAt({ noLongerOffered: "" }), DRAFT, "fact_sheet_media")).at(-1),
    ).toEqual(["/hotel-form/review", "Review and submit"]);
  });

  it("holds the questions in one form, whose blur saves the section on leaving any field", () => {
    expect(screen(editorAt(ROOMS))).toMatch(/<form noValidate=""><fieldset[^>]*>/);
  });
});

describe("the save line, in a polite live region", () => {
  it("says the answers save as they are typed, then Saving… and Saved", () => {
    expect(saveLine({ kind: "idle" })).toBe(SECTIONS_COPY.save.idle);
    expect(saveLine({ kind: "saving" })).toBe("Saving…");
    expect(saveLine({ kind: "saved" })).toBe("Saved");
    expect(saveLine({ kind: "saved" }, { hasMarked: true })).toBe(SECTIONS_COPY.save.fixMarked);
  });

  it("says Not saved – and why, with Retry", () => {
    const save = { kind: "failed" as const, message: HOTEL_FORM_COPY.errors.network };
    expect(saveLine(save)).toBe(`Not saved – ${HOTEL_FORM_COPY.errors.network}`);
    expect(buttonsIn(screen(editorAt(ROOMS, { save })))).toEqual(["Retry"]);
  });

  it("counts a 429's wait down, and holds a save for a new code", () => {
    const waiting = {
      kind: "waiting" as const,
      message: "Too many changes in a short time.",
      retryAt: NOW + 12_000,
    };
    expect(saveLine(waiting)).toBe(
      "Not saved – Too many changes in a short time. trying again in 0:12",
    );
    expect(saveLine({ kind: "session" })).toBe(SECTIONS_COPY.save.session);
  });

  it("says why a section too long to save is not sent", () => {
    expect(
      saveLine(
        { kind: "idle" },
        { problem: "This section is too long to save. Keep this section under 96 KB" },
      ),
    ).toBe("Not saved – This section is too long to save. Keep this section under 96 KB");
  });
});

describe("a colleague's save", () => {
  const theirs = {
    section: "rooms" as const,
    version: 5,
    answers: { totalRooms: 44 },
    noChanges: false,
    editedBy: "Ravi Kumar",
    editedAt: EDITED_AT,
  };

  it("is announced with when and who, and Keep mine or Take theirs", () => {
    const html = screen(editorAt(ROOMS, { save: { kind: "conflict", theirs } }));
    expect(html).toMatch(/<section role="alert" aria-labelledby="hf-conflict-heading"/);
    expect(html).toContain(
      `A colleague saved this section at ${timeOfDay(EDITED_AT)} on 26 Nov 2026`,
    );
    expect(html).toContain("Ravi Kumar saved it after you opened it.");
    expect(buttonsIn(html)).toEqual(["Keep mine", "Take theirs"]);
  });

  it("names no one when the colleague withdrew their consent", () => {
    const unnamed = { ...theirs, editedBy: null };
    const html = screen(editorAt(ROOMS, { save: { kind: "conflict", theirs: unnamed } }));
    expect(html).toContain(SECTIONS_COPY.conflict.bodyUnnamed);
    expect(html).not.toContain("null");
  });
});

describe("a locked request", () => {
  const rooms = (editor: SectionEditor<typeof ROOMS>, draft = DRAFT) =>
    screen(editor, draft, "rooms", <RoomsSection editor={editor} caps={draft.caps} />);

  it("after a refused save, says who submitted and when, keeping the unsaved text on the page", () => {
    const readOnly = {
      status: "submitted" as const,
      submittedBy: "Ravi Kumar",
      submittedAt: EDITED_AT,
    };
    const html = rooms(editorAt(ROOMS, { save: { kind: "locked", readOnly }, isReadOnly: true }));
    expect(html).toMatch(/<section role="alert" aria-labelledby="hf-locked-heading"/);
    expect(html).toContain(SECTIONS_COPY.locked.refused("Ravi Kumar", momentOf(EDITED_AT)));
    expect(html).toContain('href="/hotel-form/status"');
    expect(tagsWith(html, "input", `id="${roomsId("totalRooms")}"`)[0]).toContain('value="41"');
    expect(tagsWith(html, "fieldset", 'disabled=""')).toHaveLength(1);
    // Nothing more saves, so there is no save line.
    expect(html).not.toContain(SECTIONS_COPY.save.held);
    expect(html).not.toContain(SECTIONS_COPY.save.idle);
  });

  it("already submitted, says so from the draft and shows the answers read-only", () => {
    const draft = draftWith({
      status: "in_review",
      state: "locked",
      submittedBy: "Asha Rao",
      submittedAt: EDITED_AT,
    });
    const html = rooms(editorAt(ROOMS, { isReadOnly: true }), draft);
    expect(html).toContain(OVERVIEW_COPY.locked.submitted("Asha Rao", momentOf(EDITED_AT)));
    expect(tagsWith(html, "fieldset", 'disabled=""')).toHaveLength(1);
  });
});

describe("a refresh request", () => {
  const refresh = draftWith({ kind: "refresh" });

  it("says to fill in only what changed, offers No changes, and asks what is no longer offered", () => {
    const html = screen(editorAt(ROOMS), refresh);
    expect(html).toContain("Fill in only what changed; blanks leave our records unchanged.");
    expect(html).toContain("No changes since last time");
    expect(html).toMatch(
      /<label for="hf-rooms-noLongerOffered"[^>]*>Anything no longer offered or renamed\?<\/label>/,
    );
    expect(html).toContain("Questions");
  });

  it("puts the questions away while No changes is ticked, keeping the note", () => {
    const html = screen(editorAt(ROOMS, { noChanges: true }), refresh);
    expect(html).toContain(SECTIONS_COPY.refresh.noChangesOn);
    expect(html).not.toContain("Questions");
    expect(tagsWith(html, "input", 'id="hf-rooms-noChanges"')[0]).toContain('checked=""');
    expect(html).toContain("Anything no longer offered or renamed?");
  });

  it("asks none of it on a new hotel's request", () => {
    const html = screen(editorAt(ROOMS));
    expect(html).not.toContain("No changes since last time");
    expect(html).not.toContain("Anything no longer offered or renamed?");
    expect(html).not.toContain("Fill in only what changed");
  });
});
