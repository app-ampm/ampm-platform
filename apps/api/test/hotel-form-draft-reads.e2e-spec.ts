import { randomUUID } from "node:crypto";

import { hotelFormDraftView } from "@ampm/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { draftCalls, firstSave } from "./hotel-form-draft-suite.js";
import {
  freshMobile,
  signIn,
  startFormSuite,
  stopFormSuite,
  testLink,
  type FormSuite,
} from "./hotel-form-suite.js";

/*
 * What the draft and a save answer about each section, end to end against the test database (D-190 §3,
 * as fixed after the reviews): completeness counted from the canonical answers stored, so a save's answer,
 * the stored flag and the next read agree. Synthetic data only.
 */
describe("The hotel form's draft as each section reads back (e2e)", () => {
  let suite: FormSuite;
  const calls = draftCalls(() => suite);

  beforeAll(async () => {
    suite = await startFormSuite("e2e-hf-draft-reads-");
  });

  afterAll(async () => {
    await stopFormSuite(suite);
  });

  const LAWN = {
    rowId: randomUUID(),
    name: "E2E Synthetic Lawn",
    setting: "outdoor",
    area: { value: 900, unit: "sqm" },
    seated: 300,
    floating: 600,
  };

  it("counts a venue row whose only answer is an all-null range as blank, in the save, the row and the read", async () => {
    const link = await testLink(suite);
    const { sessionToken } = await signIn(suite, link.secret, freshMobile());
    const blank = { rowId: randomUUID(), seated: { min: null, max: null } };
    const saved = await calls
      .save(sessionToken, "venues", firstSave({ rows: [LAWN, blank] }))
      .expect(200);
    expect(saved.body.data.isComplete).toBe(true);
    const row = await suite.prisma.hotelInfoRequestSection.findFirstOrThrow({
      where: { requestId: link.id, sectionKey: "venues" },
      select: { isComplete: true, answers: true },
    });
    expect(row.isComplete).toBe(true);
    expect(row.answers).toEqual({ rows: [LAWN, { rowId: blank.rowId }] });
    const draft = hotelFormDraftView.parse((await calls.draft(sessionToken).expect(200)).body.data);
    expect(draft.sections.venues.isComplete).toBe(true);
  });
});
