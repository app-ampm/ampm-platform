import { Activity } from "react";
import { Platform } from "react-native";

import { announcePolitely as liveRegionAnnounce } from "../lib/live-region";
import { spyOnAnnounce } from "../test/announce";
import { render, renderHook } from "../test/render";
import { announcementText, politeLiveRegion, useAnnounce } from "./use-announce";

// The web's live region writes to the DOM (live-region.web.ts, tested in the web project); here it
// only records what useAnnounce sends it.
jest.mock("../lib/live-region", () => ({ announcePolitely: jest.fn() }));
const announcePolitely = jest.mocked(liveRegionAnnounce);

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
    announce = spyOnAnnounce();
    announcePolitely.mockClear();
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

  // Activity (React 19.3, expo-router screens past an activityThreshold) runs effect cleanup on
  // hide and the effect again on show, keeping refs: the re-run this renderer does perform, and
  // the same path a strict-mode double effect takes in development.
  describe("inside Activity", () => {
    function Announcer({ message }: { message: string }) {
      useAnnounce(message, true);
      return null;
    }
    function screenAt(mode: "visible" | "hidden", message = "Something went wrong") {
      return (
        <Activity mode={mode}>
          <Announcer message={message} />
        </Activity>
      );
    }

    it("stays silent when a screen is shown again with the same message", async () => {
      const { rerender } = await render(screenAt("visible"));
      await rerender(screenAt("hidden"));
      await rerender(screenAt("visible"));
      await rerender(screenAt("hidden"));
      await rerender(screenAt("visible"));
      expect(announce).toHaveBeenCalledTimes(1);
    });

    it("announces on show when the message changed while hidden", async () => {
      const { rerender } = await render(screenAt("visible"));
      await rerender(screenAt("hidden", "You are offline"));
      expect(announce).toHaveBeenCalledTimes(1);
      await rerender(screenAt("visible", "You are offline"));
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith("You are offline", { queue: true });
    });

    it("waits until a screen first rendered hidden is shown", async () => {
      const { rerender } = await render(screenAt("hidden"));
      expect(announce).not.toHaveBeenCalled();
      await rerender(screenAt("visible"));
      expect(announce).toHaveBeenCalledTimes(1);
    });
  });

  it.each(["android", "web"] as const)("leaves %s to its own live region or role", async (os) => {
    jest.replaceProperty(Platform, "OS", os);
    await renderAnnounce({ message: "Enter a name", isActive: true });
    expect(announce).not.toHaveBeenCalled();
    expect(announcePolitely).not.toHaveBeenCalled();
  });

  describe("with { web: true }", () => {
    function renderPolite(message: string, isActive = true) {
      return renderHook(
        ({ text, active }: { text: string; active: boolean }) =>
          useAnnounce(text, active, { web: true }),
        { initialProps: { text: message, active: isActive } },
      );
    }

    it("speaks on the web through the page's live region, once per message", async () => {
      jest.replaceProperty(Platform, "OS", "web");
      const { rerender } = await renderPolite("Offline. 3 updates queued.");
      await rerender({ text: "Offline. 3 updates queued.", active: true });
      await rerender({ text: "Offline. 4 updates queued.", active: true });
      expect(announcePolitely.mock.calls).toEqual([
        ["Offline. 3 updates queued."],
        ["Offline. 4 updates queued."],
      ]);
      expect(announce).not.toHaveBeenCalled();
    });

    it("stays silent on the web while inactive", async () => {
      jest.replaceProperty(Platform, "OS", "web");
      await renderPolite("Offline.", false);
      expect(announcePolitely).not.toHaveBeenCalled();
    });

    it("still leaves Android to the notice's own live region, and iOS to VoiceOver", async () => {
      jest.replaceProperty(Platform, "OS", "android");
      await renderPolite("Offline.");
      expect(announcePolitely).not.toHaveBeenCalled();
      expect(announce).not.toHaveBeenCalled();
      jest.restoreAllMocks();
      jest.replaceProperty(Platform, "OS", "ios");
      announce = spyOnAnnounce();
      await renderPolite("Offline.");
      expect(announce).toHaveBeenCalledWith("Offline.", { queue: true });
      expect(announcePolitely).not.toHaveBeenCalled();
    });
  });
});

describe("politeLiveRegion", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is a polite live region on Android and nothing on iOS or the web", () => {
    jest.replaceProperty(Platform, "OS", "android");
    expect(politeLiveRegion()).toEqual({ accessibilityLiveRegion: "polite" });
    for (const os of ["ios", "web"] as const) {
      jest.replaceProperty(Platform, "OS", os);
      expect(politeLiveRegion()).toEqual({});
    }
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
