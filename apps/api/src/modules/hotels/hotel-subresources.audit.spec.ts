import { describe, expect, it } from "vitest";

import { staffPrincipal } from "../../policy/testing/staff-principal.js";
import { HOTEL_ID } from "./testing/staff-hotel-fixtures.js";
import {
  buildSubresourcesService,
  CONTACT_ID,
  contactRow,
  ROOM_ID,
  roomRow,
  VENUE_ID,
  venueRow,
} from "./testing/subresource-fixtures.js";

/*
 * The audit of a staff write to a hotel's room, venue or contact (security.md: before and after values).
 * Each event names the row and the fields the write set or changed, compared as the staff view reads
 * them, never their values (a contact's phone or email stays out of the images), except a contact's
 * primary flag, which a contact create and a demotion record; and each lands in the write's own
 * transaction, deletes included, so a write is never committed unaudited.
 */

const HT = staffPrincipal(["HT"]);
const ACTOR = HT.userId;
const TX = { transaction: "synthetic" };

/** The service over fakes whose transaction hands its work one recognisable client. */
function build() {
  const built = buildSubresourcesService();
  built.repo.transaction.mockImplementation(async (work) => work(TX));
  return built;
}

type Built = ReturnType<typeof build>;

/** Each child's delete, the soft delete it makes, and the stored row's name. */
const DELETES = [
  {
    entityType: "hotel_room_category",
    id: ROOM_ID,
    name: "Synthetic Lake Suite",
    remove: (built: Built) => built.service.removeRoom(HOTEL_ID, ROOM_ID, ACTOR),
    softDelete: (built: Built) => built.repo.softDeleteRoom,
  },
  {
    entityType: "hotel_venue",
    id: VENUE_ID,
    name: "Synthetic Grand Hall",
    remove: (built: Built) => built.service.removeVenue(HOTEL_ID, VENUE_ID, ACTOR),
    softDelete: (built: Built) => built.repo.softDeleteVenue,
  },
  {
    entityType: "hotel_contact",
    id: CONTACT_ID,
    name: "Synthetic Sales Desk",
    remove: (built: Built) => built.service.removeContact(HOTEL_ID, CONTACT_ID, ACTOR),
    softDelete: (built: Built) => built.repo.softDeleteContact,
  },
];

describe("auditing a staff update of a room, venue or contact", () => {
  it("names the fields a room update changed, the sq ft its units rule cleared among them", async () => {
    const { service, repo, audit } = build();
    repo.updateRoom.mockResolvedValueOnce(roomRow({ sizeSqm: 40, sizeSqft: null }));
    await service.updateRoom(HOTEL_ID, ROOM_ID, { sizeSqm: 40 }, ACTOR);
    expect(audit.record).toHaveBeenCalledWith(
      {
        action: "update",
        entityType: "hotel_room_category",
        entityId: ROOM_ID,
        before: { name: "Synthetic Lake Suite" },
        after: { name: "Synthetic Lake Suite", changedFields: ["sizeSqm", "sizeSqft"] },
        maskImages: false,
      },
      TX,
    );
  });

  it("keeps a renamed room's old name, which the next rooms import matches on", async () => {
    const { service, repo, audit } = build();
    repo.updateRoom.mockResolvedValueOnce(roomRow({ name: "Synthetic Premier", sizeSqft: 500 }));
    await service.updateRoom(HOTEL_ID, ROOM_ID, { name: "Synthetic Premier" }, ACTOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { name: "Synthetic Lake Suite" },
        after: { name: "Synthetic Premier", changedFields: ["name"] },
      }),
      TX,
    );
  });

  it("names a venue's new setting and the is_indoor flag it moved", async () => {
    const { service, repo, audit } = build();
    repo.updateVenue.mockResolvedValueOnce(
      venueRow({ setting: "semi_open", isIndoor: false, prefunctionAreaSqft: 1_000 }),
    );
    await service.updateVenue(HOTEL_ID, VENUE_ID, { setting: "semi_open" }, ACTOR);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "hotel_venue",
        after: { name: "Synthetic Grand Hall", changedFields: ["isIndoor", "setting"] },
      }),
      TX,
    );
  });

  it("records that a contact became the primary, even when no one was demoted", async () => {
    const { service, repo, audit } = build();
    repo.updateContact.mockResolvedValueOnce(
      contactRow({ phone: "Front desk 0141 234567", isPrimary: true }),
    );
    await service.updateContact(HOTEL_ID, CONTACT_ID, { isPrimary: true }, HT);
    expect(audit.record).toHaveBeenCalledOnce();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        before: { name: "Synthetic Sales Desk" },
        after: { name: "Synthetic Sales Desk", changedFields: ["isPrimary"] },
      }),
      TX,
    );
  });

  it("names a changed email without its value, and a repeated legacy phone as no change", async () => {
    const { service, repo, audit } = build();
    repo.updateContact.mockResolvedValueOnce(
      contactRow({ phone: "Front desk 0141 234567", email: "events@example.com" }),
    );
    await service.updateContact(
      HOTEL_ID,
      CONTACT_ID,
      { phone: "Front desk 0141 234567", email: "events@example.com" },
      HT,
    );
    const event = audit.record.mock.calls[0]?.[0];
    expect(event).toMatchObject({ after: { changedFields: ["email"] } });
    expect(JSON.stringify(event)).not.toContain("example.com");
  });
});

describe("auditing a staff create or delete of a room, venue or contact", () => {
  it("audits a new room in its own transaction, naming the fields it sets", async () => {
    const { service, repo, audit } = build();
    repo.createRoom.mockResolvedValueOnce(
      roomRow({ roomCount: 4, maxOccupancy: null, sizeSqm: 79, sizeSqft: 850, facilities: null }),
    );
    await service.addRoom(HOTEL_ID, { name: "Synthetic Lake Suite", sizeSqft: 850 }, ACTOR);
    expect(repo.createRoom).toHaveBeenCalledWith(HOTEL_ID, expect.anything(), ACTOR, TX);
    expect(audit.record).toHaveBeenCalledWith(
      {
        action: "create",
        entityType: "hotel_room_category",
        entityId: ROOM_ID,
        before: null,
        after: {
          name: "Synthetic Lake Suite",
          changedFields: ["name", "roomCount", "sizeSqm", "sizeSqft"],
        },
        maskImages: false,
      },
      TX,
    );
  });

  it("audits a new venue in its own transaction", async () => {
    const { service, repo, audit } = build();
    await service.addVenue(
      HOTEL_ID,
      { name: "Synthetic Grand Hall", venueType: "ballroom", setting: "indoor" },
      ACTOR,
    );
    expect(repo.createVenue).toHaveBeenCalledWith(HOTEL_ID, expect.anything(), ACTOR, TX);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", entityType: "hotel_venue", entityId: VENUE_ID }),
      TX,
    );
  });

  it("audits a new contact by the fields it sets and its primary flag, never its phone or email", async () => {
    const { service, repo, audit } = build();
    const phone = "+911234567801";
    const email = "desk@example.com";
    repo.createContact.mockResolvedValueOnce(contactRow({ phone, email }));
    const request = { name: "Synthetic Sales Desk", phone, email, isPrimary: false };
    await service.addContact(HOTEL_ID, request, HT);
    const event = audit.record.mock.calls[0]?.[0];
    expect(event).toEqual({
      action: "create",
      entityType: "hotel_contact",
      entityId: CONTACT_ID,
      before: null,
      after: {
        name: "Synthetic Sales Desk",
        changedFields: ["name", "phone", "email", "isPrimary"],
        isPrimary: false,
      },
      maskImages: false,
    });
    expect(JSON.stringify(event)).not.toContain(phone);
    expect(JSON.stringify(event)).not.toContain(email);
  });

  it.each(DELETES)(
    "deletes a $entityType and audits it in the delete's transaction",
    async ({ entityType, id, name, remove, softDelete }) => {
      const built = build();
      await remove(built);
      expect(softDelete(built)).toHaveBeenCalledWith(id, ACTOR, TX);
      expect(built.audit.record).toHaveBeenCalledWith(
        {
          action: "delete",
          entityType,
          entityId: id,
          before: { name },
          after: { deleted: true },
          maskImages: false,
        },
        TX,
      );
    },
  );

  it("runs a room's delete and its audit in the one transaction that fails with it", async () => {
    const { service, repo, audit } = build();
    audit.record.mockRejectedValueOnce(new Error("synthetic audit failure"));
    await expect(service.removeRoom(HOTEL_ID, ROOM_ID, ACTOR)).rejects.toThrow(
      "synthetic audit failure",
    );
    expect(repo.transaction).toHaveBeenCalledOnce();
    expect(repo.softDeleteRoom).toHaveBeenCalledWith(ROOM_ID, ACTOR, TX);
  });
});
