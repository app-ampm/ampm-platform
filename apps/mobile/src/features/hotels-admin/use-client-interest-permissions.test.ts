import { clientInterestPermissionsFor } from "./use-client-interest-permissions";

describe("clientInterestPermissionsFor", () => {
  it("lets the Hotel team, Sales and the Super Admin read clients' saves and open the client", () => {
    for (const role of ["HT", "SM", "SA"] as const) {
      expect(clientInterestPermissionsFor([role])).toEqual({
        canReadSavedHotels: true,
        canOpenClient: true,
      });
    }
  });

  it("gives a Project Manager neither: the assigned grants do not reach these project-less routes", () => {
    expect(clientInterestPermissionsFor(["PM"])).toEqual({
      canReadSavedHotels: false,
      canOpenClient: false,
    });
  });

  it("gives Finance and Creative no read of clients' saves", () => {
    expect(clientInterestPermissionsFor(["FA"]).canReadSavedHotels).toBe(false);
    expect(clientInterestPermissionsFor(["CD"]).canReadSavedHotels).toBe(false);
  });
});
