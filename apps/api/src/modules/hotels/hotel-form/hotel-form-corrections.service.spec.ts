import { errors, HOTEL_FORM_ERRORS, hotelFormSessionRefusalOf } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { BotCheckAdapter } from "../../../common/bot-check/bot-check.adapter.js";
import type { Env } from "../../../env.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import { FORM_IP, FORM_SITE, refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  formSession,
  formSubmission,
  formSubmissions,
  formTransactions,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import {
  HOTEL_FORM_CORRECTION_ENTITY,
  HotelFormCorrections,
} from "./hotel-form-corrections.service.js";
import type { HotelFormLimits } from "./hotel-form-limits.js";
import type { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import type { HotelFormStaffNotices } from "./hotel-form-staff-notices.js";
import type { FormSubmission } from "./hotel-form-submissions.repository.js";

/*
 * A correction after submitting (D-190 §3) with fakes: only once the request has been submitted (409
 * notSubmitted before), with a Turnstile pass for `hf_correction` (400), at most 5 per request a day
 * (429 correctionLimit), allowed while locked and while status-only. The message is stored in its own
 * restricted row and goes nowhere else: not the event, not the audit, not the staff notice.
 */

const MESSAGE = "The lawn seats 900 guests, not 600.";
const CORRECTION_ID = "0192f1a0-0000-7000-8000-0000000000f1";

function build(options: { readonly request?: FormSubmission; readonly human?: boolean } = {}) {
  const request = options.request ?? submittedRequest();
  const submissions = formSubmissions(request);
  const allowCorrection = vi.fn(async () => undefined);
  const journal = { event: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const correction = vi.fn(async () => 4);
  const verify = vi.fn(async () => options.human ?? true);
  const corrections = new HotelFormCorrections(
    formTransactions() as unknown as HotelFormRequestsRepository,
    submissions.typed,
    { allowCorrection } as unknown as HotelFormLimits,
    journal as unknown as HotelInfoRequestJournal,
    audit as unknown as AuditService,
    { correction } as unknown as HotelFormStaffNotices,
    { verify } as unknown as BotCheckAdapter,
    { PUBLIC_SITE_URL: FORM_SITE } as unknown as Env,
  );
  const sub = submissions.repository;
  return { corrections, sub, allowCorrection, journal, audit, correction, verify };
}

const send = (built: ReturnType<typeof build>, session = formSession({ state: "locked" })) =>
  built.corrections.request(session, { message: MESSAGE, botToken: "pass" }, FORM_IP, FORM_NOW);

describe("HotelFormCorrections", () => {
  it("stores the message, records the event and the audit by id, then tells staff", async () => {
    const built = build();
    expect(await send(built)).toEqual({ ok: true });
    expect(built.sub.createCorrection).toHaveBeenCalledWith(
      { requestId: FORM_REQUEST_ID, personId: FORM_PERSON_ID, message: MESSAGE },
      FORM_TX,
    );
    expect(built.allowCorrection).toHaveBeenCalledWith(FORM_REQUEST_ID);
    expect(built.journal.event).toHaveBeenCalledWith(
      {
        requestId: FORM_REQUEST_ID,
        eventType: "correction_requested",
        actor: { kind: "hotel_person", personId: FORM_PERSON_ID },
        at: FORM_NOW,
        detail: { correctionId: CORRECTION_ID },
      },
      FORM_TX,
    );
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "create",
        entityType: HOTEL_FORM_CORRECTION_ENTITY,
        entityId: CORRECTION_ID,
        after: { id: CORRECTION_ID, requestId: FORM_REQUEST_ID, personId: FORM_PERSON_ID },
      },
      FORM_TX,
    );
    expect(built.correction).toHaveBeenCalledWith(FORM_REQUEST_ID);
    expect(built.verify).toHaveBeenCalledWith("pass", {
      remoteIp: FORM_IP,
      expectedHostnames: ["site.synthetic.example"],
      expectedAction: "hf_correction",
    });
    const elsewhere = JSON.stringify([
      built.journal.event.mock.calls,
      built.audit.record.mock.calls,
      built.correction.mock.calls,
    ]);
    expect(elsewhere).not.toContain("lawn");
  });

  it("takes a correction while locked, while showing the status only, and when changes are asked for", async () => {
    const until = new Date("2026-12-02T00:00:00.000Z");
    for (const request of [
      submittedRequest({ status: "in_review" }),
      submittedRequest({ status: "merged", statusOnlyUntil: until }),
      submittedRequest({ status: "changes_requested" }),
    ]) {
      expect(await send(build({ request }))).toEqual({ ok: true });
    }
  });

  it("refuses a request never submitted with 409 notSubmitted, spending no pass and no count", async () => {
    const built = build({ request: formSubmission() });
    const refused = await refusalOf(send(built, formSession()));
    expect(refused?.status).toBe(409);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.notSubmitted);
    expect(built.verify).not.toHaveBeenCalled();
    expect(built.allowCorrection).not.toHaveBeenCalled();
    expect(built.sub.createCorrection).not.toHaveBeenCalled();
  });

  it("refuses a failed bot check with 400 on botToken, counting nothing", async () => {
    const built = build({ human: false });
    const refused = await refusalOf(send(built));
    expect(refused?.details).toEqual([{ path: "botToken", message: HOTEL_FORM_ERRORS.botCheck }]);
    expect(built.allowCorrection).not.toHaveBeenCalled();
    expect(built.sub.createCorrection).not.toHaveBeenCalled();
  });

  it("refuses the sixth correction of the day with 429 correctionLimit, storing nothing", async () => {
    const built = build();
    built.allowCorrection.mockRejectedValueOnce(
      errors.rateLimited(HOTEL_FORM_ERRORS.correctionLimit, 3600),
    );
    const refused = await refusalOf(send(built));
    expect(refused?.status).toBe(429);
    expect(refused?.message).toBe(HOTEL_FORM_ERRORS.correctionLimit);
    expect(built.sub.createCorrection).not.toHaveBeenCalled();
    expect(built.correction).not.toHaveBeenCalled();
  });

  it("answers 401 not_active for a request that left the form", async () => {
    const built = build({ request: submittedRequest({ status: "rejected" }) });
    const refused = await refusalOf(send(built));
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("not_active");
  });
});
