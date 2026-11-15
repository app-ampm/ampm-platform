import { describe, expect, it, vi } from "vitest";

import {
  DEMO_ACCOUNT,
  DEMO_CONTACT,
  DEMO_LEAD,
  DEMO_USER,
  upsertDemoAccount,
} from "./demo-baseline.js";

type Writer = Parameters<typeof upsertDemoAccount>[0];

function harness(source: unknown = { id: "source-1" }, owner: unknown = { id: "sales-1" }) {
  const leadSource = { findFirst: vi.fn(async () => source) };
  const user = { findFirst: vi.fn(async () => owner) };
  const lead = { upsert: vi.fn(async () => ({})) };
  const clientAccount = { upsert: vi.fn(async () => ({})) };
  const accountContact = { upsert: vi.fn(async () => ({})) };
  const db = { leadSource, user, lead, clientAccount, accountContact } as unknown as Writer;
  return { db, leadSource, user, lead, clientAccount, accountContact };
}

describe("upsertDemoAccount", () => {
  it("upserts the demo account linked to the demo user and its originating lead", async () => {
    const h = harness();
    await upsertDemoAccount(h.db);

    // The originating Sales lead, owned by Sales when present, flagged a demo request.
    expect(h.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEMO_LEAD.id },
        create: expect.objectContaining({ requestedDemo: true, ownerUserId: "sales-1" }),
      }),
    );
    // The account is is_demo, linked to the lead and to the demo user as primary contact.
    expect(h.clientAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEMO_ACCOUNT.id },
        create: expect.objectContaining({
          isDemo: true,
          leadId: DEMO_LEAD.id,
          primaryContactUserId: DEMO_USER.id,
        }),
      }),
    );
    // The self contact's user_id is what resolves the demo user to this account (accountIdForUser).
    expect(h.accountContact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DEMO_CONTACT.id },
        create: expect.objectContaining({
          accountId: DEMO_ACCOUNT.id,
          relation: "self",
          userId: DEMO_USER.id,
        }),
      }),
    );
  });

  it("links no owner when Sales is absent (the activity still lands)", async () => {
    const h = harness({ id: "source-1" }, null);
    await upsertDemoAccount(h.db);
    expect(h.lead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ ownerUserId: null }) }),
    );
  });

  it("fails fast when the lead source has not been seeded", async () => {
    const h = harness(null);
    await expect(upsertDemoAccount(h.db)).rejects.toThrow(/lead source/);
    expect(h.lead.upsert).not.toHaveBeenCalled();
  });
});
