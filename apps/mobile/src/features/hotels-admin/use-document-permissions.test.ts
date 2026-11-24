import { staffAccessFor } from "@ampm/api-client";
import type { StaffRoleCode } from "@ampm/core";

import { documentPermissionsFor } from "./use-document-permissions";

/** A signed-in staff member's access from their system roles and a custom role's capabilities. */
function access(roles: StaffRoleCode[], customCapabilities: string[] = []) {
  return staffAccessFor({
    principal: {
      type: "staff",
      userId: "018f0000-0000-7000-8000-00000000cafe",
      name: "Test Person",
      email: "person@example.com",
      phone: null,
      status: "active",
      lastLoginAt: null,
    },
    roles,
    customCapabilities,
  });
}

const NOTHING = {
  canUpload: false,
  canReplace: false,
  canDelete: false,
  canStartFbCard: false,
};

describe("documentPermissionsFor (permission-matrix §5.3, Hotel documents)", () => {
  it("lets the Hotel team and the Super Admin do everything, a draft F&B card included", () => {
    const all = {
      canUpload: true,
      canReplace: true,
      canDelete: true,
      canStartFbCard: true,
    };
    expect(documentPermissionsFor(access(["HT"]))).toEqual(all);
    expect(documentPermissionsFor(access(["SA"]))).toEqual(all);
  });

  it("lets a Sales Manager and a project manager read and open documents, and change nothing", () => {
    expect(documentPermissionsFor(access(["SM"]))).toEqual(NOTHING);
    expect(documentPermissionsFor(access(["PM"]))).toEqual(NOTHING);
  });

  it("gives Finance, which reads rate cards but not documents, nothing here", () => {
    expect(documentPermissionsFor(access(["FA"]))).toEqual(NOTHING);
  });

  it("D-164: a replacement needs the update grant beside the create grant the upload route checks", () => {
    const createOnly = access([], ["hotels.hotel_documents.create:all"]);
    expect(documentPermissionsFor(createOnly)).toMatchObject({
      canUpload: true,
      canReplace: false,
    });
    const updateOnly = access([], ["hotels.hotel_documents.update:all"]);
    expect(documentPermissionsFor(updateOnly)).toMatchObject({
      canUpload: false,
      canReplace: false,
    });
    const both = access(
      [],
      ["hotels.hotel_documents.create:all", "hotels.hotel_documents.update:all"],
    );
    expect(documentPermissionsFor(both)).toMatchObject({ canUpload: true, canReplace: true });
  });

  it("D-164: offers the draft F&B card only with the rate-card create grant", () => {
    const custom = access(
      [],
      ["hotels.hotel_documents.read:all", "hotels.rate_cards_rate_items.create:all"],
    );
    expect(documentPermissionsFor(custom)).toEqual({
      ...NOTHING,
      canStartFbCard: true,
    });
  });
});
