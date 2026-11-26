import { describe, expect, it } from "vitest";

import {
  HOTEL_FORM_ACCURACY_DECLARATION,
  HOTEL_FORM_ACCURACY_VERSION,
  HOTEL_FORM_CORRECTION_ACTION,
  HOTEL_FORM_CORRECTION_MAX,
  HOTEL_FORM_DISPLAY_AUTHORISATION,
  HOTEL_FORM_DISPLAY_VERSION,
  HOTEL_FORM_SUBMIT_ACTION,
  hotelFormCorrectionRequest,
  hotelFormSubmitRequest,
  hotelFormSubmitted,
  hotelFormWithdrawalRequest,
  hotelFormWithdrawn,
} from "./hotel-form-declarations";
import { HOTEL_FORM_CODE_ACTION, HOTEL_FORM_NOTICE_VERSION } from "./hotel-form";

/*
 * The two declarations of submit (D-190 §2 and §3; plan §4.4, wording in
 * docs/planning/hotel-information-form-wording.md, a draft for counsel, HF-G2) and the bodies of submit,
 * corrections and withdrawal. A consent records the wording's version, so the words never change
 * without it: each version below is pinned to a fingerprint of its words.
 */

/** FNV-1a over the UTF-16 code units: enough to notice an edit to the words. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

const accuracyWords = (): string => HOTEL_FORM_ACCURACY_DECLARATION.statement;
const displayWords = (): string => {
  const { question, ifYes, ifNo, yes, no } = HOTEL_FORM_DISPLAY_AUTHORISATION;
  return [question, ifYes, ifNo, yes, no].join("\n");
};

const submit = {
  accuracy: { accepted: true, textVersion: HOTEL_FORM_ACCURACY_VERSION },
  display: { answer: "no", textVersion: HOTEL_FORM_DISPLAY_VERSION },
  sectionVersions: {
    property: 2,
    contact: 1,
    rooms: 0,
    venues: 0,
    booking_terms: 0,
    food_beverage: 0,
    fact_sheet_media: 0,
  },
  botToken: "turnstile-pass",
};

describe("the declarations' words and versions", () => {
  it("are versioned like the privacy notice, short enough for the consent's column", () => {
    expect(HOTEL_FORM_ACCURACY_VERSION).toMatch(/^hf-accuracy-\d{4}-\d{2}-\d{2}$/);
    expect(HOTEL_FORM_DISPLAY_VERSION).toMatch(/^hf-display-\d{4}-\d{2}-\d{2}$/);
    for (const version of [HOTEL_FORM_ACCURACY_VERSION, HOTEL_FORM_DISPLAY_VERSION]) {
      expect(version.length).toBeLessThanOrEqual(64);
      expect(version).not.toBe(HOTEL_FORM_NOTICE_VERSION);
    }
    expect(HOTEL_FORM_ACCURACY_DECLARATION.version).toBe(HOTEL_FORM_ACCURACY_VERSION);
    expect(HOTEL_FORM_DISPLAY_AUTHORISATION.version).toBe(HOTEL_FORM_DISPLAY_VERSION);
  });

  it("change only with a new version: bump the version when the words change, then pin it here", () => {
    const pinned: Record<string, string> = {
      "hf-accuracy-2026-11-26": "22bef8e3",
      "hf-display-2026-11-26": "5be70851",
    };
    expect(fingerprint(accuracyWords())).toBe(pinned[HOTEL_FORM_ACCURACY_VERSION]);
    expect(fingerprint(displayWords())).toBe(pinned[HOTEL_FORM_DISPLAY_VERSION]);
  });

  it("ask 7.5 as Yes or No, promising only what AMPM shows (decision 13)", () => {
    expect(HOTEL_FORM_DISPLAY_AUTHORISATION.question).toBe(
      "May AMPM show your hotel's details to its clients?",
    );
    expect(HOTEL_FORM_DISPLAY_AUTHORISATION.ifNo).toMatch(/shows none of your photographs/);
    expect(HOTEL_FORM_ACCURACY_DECLARATION.statement).toMatch(/^I confirm that the information/);
  });
});

describe("hotelFormSubmitRequest", () => {
  it("takes 7.4 accepted, 7.5 answered Yes or No, each with its wording's version, and the bot pass", () => {
    expect(hotelFormSubmitRequest.parse(submit)).toEqual(submit);
    const yes = { ...submit, display: { ...submit.display, answer: "yes" } };
    expect(hotelFormSubmitRequest.parse(yes).display.answer).toBe("yes");
    expect(HOTEL_FORM_SUBMIT_ACTION).toBe("hf_submit");
    expect(HOTEL_FORM_SUBMIT_ACTION).not.toBe(HOTEL_FORM_CODE_ACTION);
  });

  it("refuses 7.4 left unticked and 7.5 left unanswered, naming each", () => {
    const unticked = hotelFormSubmitRequest.safeParse({
      ...submit,
      accuracy: { ...submit.accuracy, accepted: false },
    });
    expect(unticked.error?.issues[0]).toMatchObject({
      path: ["accuracy", "accepted"],
      message: "Confirm that the information is correct",
    });
    const unanswered = hotelFormSubmitRequest.safeParse({
      ...submit,
      display: { textVersion: "x" },
    });
    expect(unanswered.error?.issues[0]).toMatchObject({
      path: ["display", "answer"],
      message: "Answer Yes or No",
    });
    expect(hotelFormSubmitRequest.safeParse({ ...submit, display: undefined }).success).toBe(false);
  });

  it("needs the section versions the review page showed, every section's", () => {
    const { sectionVersions: _versions, ...without } = submit;
    expect(hotelFormSubmitRequest.safeParse(without).success).toBe(false);
    const { rooms: _rooms, ...six } = submit.sectionVersions;
    expect(hotelFormSubmitRequest.safeParse({ ...submit, sectionVersions: six }).success).toBe(
      false,
    );
  });

  it("refuses an unknown key, an empty or over-long version, and takes a missing bot pass for the check", () => {
    expect(hotelFormSubmitRequest.safeParse({ ...submit, revision: 2 }).success).toBe(false);
    const version = (textVersion: string) =>
      hotelFormSubmitRequest.safeParse({ ...submit, accuracy: { accepted: true, textVersion } });
    expect(version("").success).toBe(false);
    expect(version("x".repeat(65)).success).toBe(false);
    const { botToken: _omitted, ...withoutBot } = submit;
    expect(hotelFormSubmitRequest.safeParse(withoutBot).success).toBe(true);
  });
});

describe("hotelFormSubmitted", () => {
  it("answers the reference, the status and when", () => {
    const answer = {
      reference: "HIR-2026-0007",
      status: "submitted",
      submittedAt: "2026-11-26T10:00:00.000Z",
    };
    expect(hotelFormSubmitted.parse(answer)).toEqual(answer);
    expect(hotelFormSubmitted.safeParse({ ...answer, reference: "HIR-7" }).success).toBe(false);
    expect(hotelFormSubmitted.safeParse({ ...answer, revision: 1 }).success).toBe(false);
  });
});

describe("hotelFormCorrectionRequest", () => {
  it("takes a message of 1 to 2,000 characters, trimmed, and the bot pass", () => {
    const parsed = hotelFormCorrectionRequest.parse({
      message: "  The lawn holds 900, not 600.  ",
      botToken: "pass",
    });
    expect(parsed.message).toBe("The lawn holds 900, not 600.");
    expect(HOTEL_FORM_CORRECTION_MAX).toBe(2_000);
    expect(hotelFormCorrectionRequest.safeParse({ message: "x".repeat(2_000) }).success).toBe(true);
    expect(hotelFormCorrectionRequest.safeParse({ message: "x".repeat(2_001) }).success).toBe(
      false,
    );
    expect(hotelFormCorrectionRequest.safeParse({ message: "   " }).success).toBe(false);
    expect(hotelFormCorrectionRequest.safeParse({ message: "Lawn\u0000" }).success).toBe(false);
    expect(HOTEL_FORM_CORRECTION_ACTION).toBe("hf_correction");
  });
});

describe("hotelFormWithdrawalRequest", () => {
  it("withdraws 7.5 or every consent, with or without asking for removal", () => {
    for (const kind of ["display_authorisation", "all"]) {
      for (const requestRemoval of [true, false]) {
        expect(hotelFormWithdrawalRequest.parse({ kind, requestRemoval })).toEqual({
          kind,
          requestRemoval,
        });
      }
    }
    expect(
      hotelFormWithdrawalRequest.safeParse({ kind: "privacy_notice", requestRemoval: false })
        .success,
    ).toBe(false);
    expect(hotelFormWithdrawalRequest.safeParse({ kind: "all" }).success).toBe(false);
  });
});

describe("hotelFormWithdrawn", () => {
  it("answers the kinds this call withdrew and whether a removal is asked for, nothing more", () => {
    const answer = { withdrawn: ["display_authorisation"], removalRequested: false };
    expect(hotelFormWithdrawn.parse(answer)).toEqual(answer);
    const all = {
      withdrawn: ["privacy_notice", "accuracy_attestation", "display_authorisation"],
      removalRequested: true,
    };
    expect(hotelFormWithdrawn.parse(all)).toEqual(all);
    expect(hotelFormWithdrawn.parse({ withdrawn: [], removalRequested: true }).withdrawn).toEqual(
      [],
    );
    expect(
      hotelFormWithdrawn.safeParse({ withdrawn: ["photos"], removalRequested: false }).success,
    ).toBe(false);
    expect(hotelFormWithdrawn.safeParse({ ...answer, consentIds: [] }).success).toBe(false);
  });
});
