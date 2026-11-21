import { describe, expect, it } from "vitest";

import { clientSavedHotelsPath } from "./use-client-saved-hotels";

const ACCOUNT = "0192f1a0-0000-7000-8000-000000000001";

describe("clientSavedHotelsPath", () => {
  it("is every client's list, a page of 50, with no filters", () => {
    expect(clientSavedHotelsPath({})).toBe("/hotels-admin/saved-hotels?limit=50");
  });

  it("names one client and the cursor of the next page", () => {
    expect(clientSavedHotelsPath({ accountId: ACCOUNT, cursor: "c1", limit: 20 })).toBe(
      `/hotels-admin/saved-hotels?accountId=${ACCOUNT}&cursor=c1&limit=20`,
    );
  });

  it("leaves an unset filter out rather than sending it empty", () => {
    expect(clientSavedHotelsPath({ accountId: undefined, cursor: undefined })).toBe(
      "/hotels-admin/saved-hotels?limit=50",
    );
  });
});
