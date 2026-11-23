import { referencePermissionsFor } from "./use-reference-permissions";

describe("referencePermissionsFor", () => {
  it("lets the Hotel team and the Super Admin change references", () => {
    const all = { canCreate: true, canUpdate: true, canDelete: true };
    expect(referencePermissionsFor(["HT"])).toEqual(all);
    expect(referencePermissionsFor(["SA"])).toEqual(all);
  });

  it("leaves a Sales Manager, who only reads them, with no changes", () => {
    expect(referencePermissionsFor(["SM"])).toEqual({
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    });
  });
});
