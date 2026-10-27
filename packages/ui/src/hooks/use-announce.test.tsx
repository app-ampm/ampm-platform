import { Activity } from "react";
import { Platform } from "react-native";

import { spyOnAnnounce } from "../test/announce";
import { render, renderHook } from "../test/render";
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
    announce = spyOnAnnounce();
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
