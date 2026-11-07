import { chromeAudience } from "./chrome-audience";

describe("chromeAudience", () => {
  it("draws the staff rail on the workspace's areas and their detail screens", () => {
    expect(chromeAudience("/leads", "staff")).toBe("staff");
    expect(chromeAudience("/leads/018f0000-0000-7000-8000-0000000000a1", "staff")).toBe("staff");
    expect(chromeAudience("/enquiries/abc", "staff")).toBe("staff");
    expect(chromeAudience("/field-notes", "staff")).toBe("staff");
    expect(chromeAudience("/account", "staff")).toBe("staff");
  });

  it("draws the client navigation on the portal, hotels and the account", () => {
    expect(chromeAudience("/portal", "client")).toBe("client");
    expect(chromeAudience("/portal/requests/new", "client")).toBe("client");
    expect(chromeAudience("/hotels/saved", "client")).toBe("client");
    expect(chromeAudience("/hotels/018f0000-0000-7000-8000-00000000beef", "demo")).toBe("client");
    expect(chromeAudience("/account", "client")).toBe("client");
  });

  it("draws nothing on the other audience's routes", () => {
    expect(chromeAudience("/portal", "staff")).toBeNull();
    expect(chromeAudience("/leads", "client")).toBeNull();
    expect(chromeAudience("/field-notes", "client")).toBeNull();
  });

  it("draws nothing on sign-in, the gallery or the entry redirect", () => {
    for (const path of ["/sign-in", "/gallery", "/"]) {
      expect(chromeAudience(path, "staff")).toBeNull();
      expect(chromeAudience(path, "client")).toBeNull();
    }
  });
});
