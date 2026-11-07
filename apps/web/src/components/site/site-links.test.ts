import { describe, expect, it } from "vitest";

import { wrapFocusIndex } from "./use-dialog-focus";
import { CLIENT_SIGN_IN_URL, isCurrentPath, portalUrl } from "./site-links";

describe("portal links", () => {
  it("defaults client sign-in to the local portal's /sign-in", () => {
    expect(CLIENT_SIGN_IN_URL).toBe("http://localhost:8082/sign-in");
  });

  it("joins a path to the portal address once, keeping any base path", () => {
    expect(portalUrl("/sign-in", "https://portal.example.test/")).toBe(
      "https://portal.example.test/sign-in",
    );
    expect(portalUrl("/sign-in", "https://example.test/portal")).toBe(
      "https://example.test/portal/sign-in",
    );
  });
});

describe("current page", () => {
  it("marks a nav link current on its page and the pages beneath it only", () => {
    expect(isCurrentPath("/destinations", "/destinations")).toBe(true);
    expect(isCurrentPath("/destinations/udaipur", "/destinations")).toBe(true);
    expect(isCurrentPath("/destinations-old", "/destinations")).toBe(false);
    expect(isCurrentPath("/", "/about")).toBe(false);
    expect(isCurrentPath(null, "/about")).toBe(false);
  });
});

describe("phone menu focus", () => {
  it("moves Tab forward and back through the menu, wrapping at both ends", () => {
    expect(wrapFocusIndex(0, 3, false)).toBe(1);
    expect(wrapFocusIndex(2, 3, false)).toBe(0);
    expect(wrapFocusIndex(0, 3, true)).toBe(2);
  });

  it("brings focus that escaped back to the menu's first or last control", () => {
    expect(wrapFocusIndex(-1, 3, false)).toBe(0);
    expect(wrapFocusIndex(-1, 3, true)).toBe(2);
    expect(wrapFocusIndex(-1, 0, false)).toBe(-1);
  });
});
