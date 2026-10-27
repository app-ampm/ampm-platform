import { AccessibilityInfo, Platform } from "react-native";

import { renderHook } from "../test/render";
import { announcementText, useAnnounce } from "./use-announce";

interface HookProps {
  readonly message: string | undefined;
  readonly isActive: boolean;
}

function renderAnnounce(initialProps: HookProps) {
  return renderHook(({ message, isActive }: HookProps) => useAnnounce(message, isActive), {
    initialProps,
  });
}

describe("useAnnounce", () => {
  let announce: jest.SpyInstance;
  beforeEach(() => {
    // The preset already mocks the announcer; clear it so each test counts only its own calls.
    announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    announce.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());

  it("announces once per appearance, queued, and not again on a re-render", async () => {
    const { rerender } = await renderAnnounce({ message: "Enter a name", isActive: true });
    await rerender({ message: "Enter a name", isActive: true });
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Enter a name", { queue: true });
  });

  it("announces again when the message changes while active", async () => {
    const { rerender } = await renderAnnounce({ message: "Enter a name", isActive: true });
    await rerender({ message: "Name is too long", isActive: true });
    expect(announce).toHaveBeenCalledTimes(2);
    expect(announce).toHaveBeenLastCalledWith("Name is too long", { queue: true });
  });

  it("never announces while inactive or empty, and again on the next appearance", async () => {
    const { rerender } = await renderAnnounce({ message: "Enter a name", isActive: false });
    await rerender({ message: undefined, isActive: true });
    expect(announce).not.toHaveBeenCalled();
    await rerender({ message: "Enter a name", isActive: true });
    await rerender({ message: "Enter a name", isActive: false });
    await rerender({ message: "Enter a name", isActive: true });
    expect(announce).toHaveBeenCalledTimes(2);
  });

  it.each(["android", "web"] as const)("leaves %s to its own live region or role", async (os) => {
    jest.replaceProperty(Platform, "OS", os);
    await renderAnnounce({ message: "Enter a name", isActive: true });
    expect(announce).not.toHaveBeenCalled();
  });
});

describe("announcementText", () => {
  it("joins the parts as sentences and skips empty ones", () => {
    expect(announcementText("You are offline", "Changes are kept.")).toBe(
      "You are offline. Changes are kept.",
    );
    expect(announcementText("Saved!", undefined, " ", "All good")).toBe("Saved! All good");
    expect(announcementText(undefined)).toBe("");
  });
});
