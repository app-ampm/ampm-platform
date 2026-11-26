import { hotelFormSessionRefusalOf, type HotelInfoRequestConsentKind } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AuditInput, AuditService } from "../../../policy/audit.service.js";
import type { HotelInfoRequestJournal } from "../hotel-info-request-journal.js";
import { refusalOf } from "../testing/hotel-form-fixtures.js";
import {
  FORM_NOW,
  FORM_PERSON_ID,
  FORM_REQUEST_ID,
  FORM_TX,
  formSession,
  formSubmissions,
  formTransactions,
  submittedRequest,
} from "../testing/hotel-form-draft-fixtures.js";
import { HOTEL_FORM_PERSON_ENTITY } from "./hotel-form-enrolment.service.js";
import type { HotelFormPeopleRepository } from "./hotel-form-people.repository.js";
import type { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import type { HotelFormStaffNotices } from "./hotel-form-staff-notices.js";
import type { FormSubmission } from "./hotel-form-submissions.repository.js";
import { HotelFormWithdrawals } from "./hotel-form-withdrawals.service.js";

/*
 * Withdrawing consent, and asking for one's details to be removed (D-190 §3; plan §9.3) with fakes: the
 * person's live consents of the kind are withdrawn as their own act (7.5 alone, or all of them), a removal
 * request is recorded once for a Super Admin to review, each with its event and an allow-listed audit,
 * and the Super Admins are told in-app. Allowed in every state a session reaches; a call that changes
 * nothing writes nothing and tells no one.
 */

const ALL: HotelInfoRequestConsentKind[] = [
  "privacy_notice",
  "accuracy_attestation",
  "display_authorisation",
];

function build(
  options: {
    readonly request?: FormSubmission;
    readonly live?: { id: string; kind: HotelInfoRequestConsentKind }[];
    readonly asked?: boolean;
  } = {},
) {
  const submissions = formSubmissions(options.request ?? submittedRequest());
  submissions.repository.hasRemovalRequest.mockResolvedValue(options.asked ?? false);
  const withdrawLive = vi.fn(
    async (_personId: string, kinds: readonly HotelInfoRequestConsentKind[]) =>
      (options.live ?? [{ id: "consent-7-5", kind: "display_authorisation" as const }]).filter(
        (consent) => kinds.includes(consent.kind),
      ),
  );
  const journal = { event: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async (_input: AuditInput, _tx?: unknown) => undefined) };
  const withdrawal = vi.fn(async () => 1);
  const withdrawals = new HotelFormWithdrawals(
    formTransactions() as unknown as HotelFormRequestsRepository,
    submissions.typed,
    { withdrawLive } as unknown as HotelFormPeopleRepository,
    journal as unknown as HotelInfoRequestJournal,
    audit as unknown as AuditService,
    { withdrawal } as unknown as HotelFormStaffNotices,
  );
  return { withdrawals, withdrawLive, journal, audit, withdrawal, sub: submissions.repository };
}

const event = (eventType: string, detail?: object) => ({
  requestId: FORM_REQUEST_ID,
  eventType,
  actor: { kind: "hotel_person", personId: FORM_PERSON_ID },
  at: FORM_NOW,
  ...(detail === undefined ? {} : { detail }),
});

describe("HotelFormWithdrawals", () => {
  it("withdraws 7.5, records the event and an allow-listed audit, and tells the Super Admins", async () => {
    const built = build();
    const answer = await built.withdrawals.withdraw(
      formSession({ state: "locked" }),
      { kind: "display_authorisation", requestRemoval: false },
      FORM_NOW,
    );
    expect(answer).toEqual({ withdrawn: ["display_authorisation"], removalRequested: false });
    expect(built.withdrawLive).toHaveBeenCalledWith(
      FORM_PERSON_ID,
      ["display_authorisation"],
      FORM_NOW,
      FORM_TX,
    );
    expect(built.journal.event.mock.calls).toEqual([
      [event("consent_withdrawn", { kind: "display_authorisation" }), FORM_TX],
    ]);
    expect(built.audit.record).toHaveBeenCalledWith(
      {
        action: "update",
        entityType: HOTEL_FORM_PERSON_ENTITY,
        entityId: FORM_PERSON_ID,
        after: {
          id: FORM_PERSON_ID,
          requestId: FORM_REQUEST_ID,
          consentIds: ["consent-7-5"],
          kinds: ["display_authorisation"],
          changedFields: ["withdrawnAt", "withdrawalSource"],
        },
      },
      FORM_TX,
    );
    expect(built.withdrawal).toHaveBeenCalledWith(FORM_REQUEST_ID);
  });

  it("withdraws every consent the person gave, and asks once for their details to be removed", async () => {
    const live = [
      { id: "consent-notice", kind: "privacy_notice" as const },
      { id: "consent-7-4", kind: "accuracy_attestation" as const },
      { id: "consent-7-5", kind: "display_authorisation" as const },
    ];
    const built = build({ live });
    const answer = await built.withdrawals.withdraw(
      formSession(),
      { kind: "all", requestRemoval: true },
      FORM_NOW,
    );
    expect(answer).toEqual({ withdrawn: ALL, removalRequested: true });
    expect(built.withdrawLive).toHaveBeenCalledWith(FORM_PERSON_ID, ALL, FORM_NOW, FORM_TX);
    expect(built.journal.event.mock.calls).toEqual([
      [event("consent_withdrawn", { kind: "all" }), FORM_TX],
      [event("removal_requested"), FORM_TX],
    ]);
    expect(built.audit.record.mock.calls[0]?.[0]).toMatchObject({
      after: {
        consentIds: ["consent-notice", "consent-7-4", "consent-7-5"],
        kinds: ALL,
        changedFields: ["withdrawnAt", "withdrawalSource", "removalRequested"],
      },
    });
    expect(built.withdrawal).toHaveBeenCalledTimes(1);
  });

  it("writes nothing and tells no one when nothing was live and the removal was asked already", async () => {
    const built = build({ live: [], asked: true });
    const answer = await built.withdrawals.withdraw(
      formSession(),
      { kind: "all", requestRemoval: true },
      FORM_NOW,
    );
    expect(answer).toEqual({ withdrawn: [], removalRequested: true });
    expect(built.journal.event).not.toHaveBeenCalled();
    expect(built.audit.record).not.toHaveBeenCalled();
    expect(built.withdrawal).not.toHaveBeenCalled();
  });

  it("works while the request shows its status only, after the merge", async () => {
    const until = new Date("2026-12-02T00:00:00.000Z");
    const built = build({
      request: submittedRequest({ status: "merged", statusOnlyUntil: until }),
    });
    const answer = await built.withdrawals.withdraw(
      formSession({ state: "status_only" }),
      { kind: "display_authorisation", requestRemoval: false },
      FORM_NOW,
    );
    expect(answer.withdrawn).toEqual(["display_authorisation"]);
  });

  it("answers 401 not_active for a request that left the form", async () => {
    const built = build({ request: submittedRequest({ status: "revoked" }) });
    const refused = await refusalOf(
      built.withdrawals.withdraw(
        formSession(),
        { kind: "display_authorisation", requestRemoval: false },
        FORM_NOW,
      ),
    );
    expect(refused && hotelFormSessionRefusalOf(refused)).toBe("not_active");
    expect(built.withdrawLive).not.toHaveBeenCalled();
  });
});
