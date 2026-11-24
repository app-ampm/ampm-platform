import { HOTEL_PHONE_REFUSAL } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { Prisma } from "../../generated/prisma/client.js";
import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import {
  buildSubresourcesService,
  CONTACT_ID,
  OTHER_CONTACT_ID,
  ROOM_ID,
  VENUE_ID,
} from "./testing/subresource-fixtures.js";

const HT = staffPrincipal(["HT"]);
const ACTOR = HT.userId;

describe("HotelSubresourcesService: rooms and venues (D-178)", () => {
  it("stores a room's sq ft with the m² derived from it, ignoring an m² sent beside it", async () => {
    const { service, repo } = buildSubresourcesService();
    await service.addRoom(HOTEL_ID, { name: "Synthetic Villa", sizeSqft: 850, sizeSqm: 99 }, ACTOR);
    expect(repo.createRoom).toHaveBeenCalledWith(
      HOTEL_ID,
      { name: "Synthetic Villa", sizeSqft: 850, sizeSqm: 79 },
      ACTOR,
    );
  });

  it("publishes an m² written alone on a room that stores sq ft, clearing the sq ft, audited in one transaction", async () => {
    const { service, repo, audit } = buildSubresourcesService();
    await service.updateRoom(HOTEL_ID, ROOM_ID, { sizeSqm: 40 }, ACTOR);
    expect(repo.updateRoom).toHaveBeenCalledWith(
      ROOM_ID,
      { sizeSqm: 40, sizeSqft: null },
      ACTOR,
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "update", entityType: "hotel_room_category" }),
      expect.anything(),
    );
  });

  it("writes is_indoor from a new venue's setting: semi-open is not indoor", async () => {
    const { service, repo } = buildSubresourcesService();
    await service.addVenue(
      HOTEL_ID,
      {
        name: "Synthetic Terrace",
        venueType: "terrace",
        setting: "semi_open",
        areaSqft: 5_000,
        prefunctionAreaSqft: 1_000,
      },
      ACTOR,
    );
    expect(repo.createVenue).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({
        setting: "semi_open",
        isIndoor: false,
        areaSqft: 5_000,
        areaSqm: 465,
        prefunctionAreaSqft: 1_000,
        prefunctionAreaSqm: 93,
      }),
      ACTOR,
    );
  });

  it("moves is_indoor with a venue's new setting, and leaves it when the setting is not sent", async () => {
    const { service, repo } = buildSubresourcesService();
    await service.updateVenue(HOTEL_ID, VENUE_ID, { setting: "indoor" }, ACTOR);
    expect(repo.updateVenue).toHaveBeenLastCalledWith(
      VENUE_ID,
      { setting: "indoor", isIndoor: true },
      ACTOR,
      expect.anything(),
    );
    await service.updateVenue(HOTEL_ID, VENUE_ID, { prefunctionAreaSqm: 80 }, ACTOR);
    expect(repo.updateVenue).toHaveBeenLastCalledWith(
      VENUE_ID,
      { prefunctionAreaSqm: 80, prefunctionAreaSqft: null },
      ACTOR,
      expect.anything(),
    );
  });

  it("reads a stored venue's setting from is_indoor when it has none, decimals as numbers", async () => {
    const { service } = buildSubresourcesService();
    const view = await service.updateVenue(HOTEL_ID, VENUE_ID, { capacityNotes: "x" }, ACTOR);
    expect(view).toMatchObject({ setting: "indoor", isIndoor: true, lengthM: null });
  });
});

describe("HotelSubresourcesService: one primary contact (D-178)", () => {
  it("demotes the hotel's current primary in the same transaction, auditing both", async () => {
    const { service, repo, audit } = buildSubresourcesService({ primaries: [OTHER_CONTACT_ID] });
    await service.addContact(HOTEL_ID, { name: "Synthetic Events", isPrimary: true }, HT);
    expect(repo.findLivePrimaries).toHaveBeenCalledWith(HOTEL_ID, null, expect.anything());
    expect(repo.demoteContacts).toHaveBeenCalledWith([OTHER_CONTACT_ID], ACTOR, expect.anything());
    expect(audit.record).toHaveBeenCalledWith(
      {
        action: "update",
        entityType: "hotel_contact",
        entityId: OTHER_CONTACT_ID,
        before: { isPrimary: true },
        after: { isPrimary: false, changedFields: ["isPrimary"] },
        maskImages: false,
      },
      expect.anything(),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "hotel_contact" }),
      expect.anything(),
    );
  });

  it("refuses a demotion with 403 to a principal who may add contacts but not change them", async () => {
    const { service, repo } = buildSubresourcesService({ primaries: [OTHER_CONTACT_ID] });
    const adder = staffPrincipal([], ["hotels.hotel_contacts.create:all"]);
    await expect(
      service.addContact(HOTEL_ID, { name: "Synthetic Events", isPrimary: true }, adder),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(repo.demoteContacts).not.toHaveBeenCalled();
    expect(repo.createContact).not.toHaveBeenCalled();
    await service.addContact(HOTEL_ID, { name: "Synthetic Events", isPrimary: false }, adder);
    expect(repo.createContact).toHaveBeenCalledOnce();
  });

  // Denial equals absence (security.md): the answer must not say whether a hotel whose contacts the
  // caller cannot read has a primary, so for them the update key decides before anything is read.
  it("answers a caller who cannot read contacts alike with or without a primary, reading none", async () => {
    const adder = staffPrincipal([], ["hotels.hotel_contacts.create:all"]);
    for (const primaries of [[OTHER_CONTACT_ID], []]) {
      const { service, repo } = buildSubresourcesService({ primaries });
      await expect(
        service.addContact(HOTEL_ID, { name: "Synthetic Events", isPrimary: true }, adder),
      ).rejects.toMatchObject({ code: "forbidden" });
      expect(repo.findLivePrimaries).not.toHaveBeenCalled();
      expect(repo.createContact).not.toHaveBeenCalled();
    }
  });

  it("lets a caller who changes but cannot read contacts make one primary either way", async () => {
    const keys = ["hotels.hotel_contacts.create:all", "hotels.hotel_contacts.update:all"];
    const writer = staffPrincipal([], keys);
    for (const primaries of [[OTHER_CONTACT_ID], []]) {
      const { service, repo } = buildSubresourcesService({ primaries });
      await service.addContact(HOTEL_ID, { name: "Synthetic Events", isPrimary: true }, writer);
      expect(repo.createContact).toHaveBeenCalledOnce();
    }
  });

  it("demotes no one when the contact being made primary already is", async () => {
    const { service, repo } = buildSubresourcesService();
    await service.updateContact(HOTEL_ID, CONTACT_ID, { isPrimary: true }, HT);
    expect(repo.findLivePrimaries).toHaveBeenCalledWith(HOTEL_ID, CONTACT_ID, expect.anything());
    expect(repo.demoteContacts).not.toHaveBeenCalled();
  });

  it("answers 409 when the unique index refuses a second primary made at the same time", async () => {
    const { service, repo } = buildSubresourcesService();
    repo.transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    await expect(
      service.addContact(HOTEL_ID, { name: "Synthetic Events", isPrimary: true }, HT),
    ).rejects.toMatchObject({ code: "conflict" });
  });
});

describe("HotelSubresourcesService: contact phones in E.164 (D-178)", () => {
  it("stores a phone in E.164", async () => {
    const { service, repo } = buildSubresourcesService();
    await service.addContact(
      HOTEL_ID,
      { name: "Synthetic Desk", phone: "0123 456 7801", isPrimary: false },
      HT,
    );
    expect(repo.createContact).toHaveBeenCalledWith(
      HOTEL_ID,
      expect.objectContaining({ phone: "+911234567801" }),
      ACTOR,
      expect.anything(),
    );
  });

  it("refuses a phone with an extension with 400 naming phone, writing nothing", async () => {
    const { service, repo } = buildSubresourcesService();
    const write = service.addContact(
      HOTEL_ID,
      { name: "Synthetic Desk", phone: "+91 12345 67801 ext 12", isPrimary: false },
      HT,
    );
    await expect(write).rejects.toMatchObject({
      code: "validation_failed",
      details: [{ path: "phone", message: HOTEL_PHONE_REFUSAL }],
    });
    expect(repo.transaction).not.toHaveBeenCalled();
  });

  it("keeps a legacy phone the edit repeats, and clears a blank one", async () => {
    const { service, repo } = buildSubresourcesService();
    await service.updateContact(
      HOTEL_ID,
      CONTACT_ID,
      { phone: "Front desk 0141 234567", roleTitle: "Sales" },
      HT,
    );
    expect(repo.updateContact).toHaveBeenLastCalledWith(
      CONTACT_ID,
      { phone: "Front desk 0141 234567", roleTitle: "Sales" },
      ACTOR,
      expect.anything(),
    );
    await service.updateContact(HOTEL_ID, CONTACT_ID, { phone: "" }, HT);
    expect(repo.updateContact).toHaveBeenLastCalledWith(
      CONTACT_ID,
      { phone: null },
      ACTOR,
      expect.anything(),
    );
  });

  it("still answers a contact edit only to a reader of the contacts (D-171)", async () => {
    const { service } = buildSubresourcesService();
    const blind = staffPrincipal([], ["hotels.hotel_contacts.update:all"]);
    await expect(
      service.updateContact(HOTEL_ID, CONTACT_ID, { roleTitle: "Sales" }, blind),
    ).rejects.toMatchObject({ code: "not_found" });
  });
});
