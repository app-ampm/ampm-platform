import { Platform } from "react-native";

import { uiCopy } from "../../copy";
import { spyOnAnnounce } from "../../test/announce";
import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { OfflineState } from "../offline-state";

describe("state views", () => {
  it("renders an empty state with its action", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <EmptyState
        title="No requests yet"
        description="They appear here."
        action={{ label: "New request", onPress }}
      />,
    );
    expect(screen.getByRole("header", { name: "No requests yet" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "New request" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("renders the error state as an alert with a retry", async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<ErrorState onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.error.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("renders the offline state with the default copy", async () => {
    await renderWithProviders(<OfflineState />);
    expect(screen.getByText(uiCopy.offline.title)).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  describe("announcements", () => {
    let announce: jest.SpyInstance;
    beforeEach(() => {
      announce = spyOnAnnounce();
    });
    afterEach(() => jest.restoreAllMocks());

    // Once only: a second announcer on the same surface would make VoiceOver say it twice.
    it("announces the error state on iOS, once", async () => {
      await renderWithProviders(<ErrorState />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(`${uiCopy.error.title}. ${uiCopy.error.description}`, {
        queue: true,
      });
    });

    // Once, and politely: being offline is a state to know about, not an alert.
    it("announces the offline state on iOS, once and without an alert", async () => {
      await renderWithProviders(<OfflineState />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        `${uiCopy.offline.title}. ${uiCopy.offline.description}`,
        { queue: true },
      );
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.getByText(uiCopy.offline.description)).not.toHaveProp(
        "accessibilityRole",
        "alert",
      );
    });

    // Announcing (ui.md) a surface hidden from the tree makes VoiceOver speak what it cannot reach.
    it("keeps a hidden error state and a hidden offline state silent", async () => {
      await renderWithProviders(<ErrorState accessibilityElementsHidden />);
      await renderWithProviders(<OfflineState importantForAccessibility="no-hide-descendants" />);
      await renderWithProviders(<ErrorState aria-hidden />);
      expect(announce).not.toHaveBeenCalled();
    });

    it("keeps the empty state silent", async () => {
      await renderWithProviders(
        <EmptyState title="No requests yet" description="They appear here." />,
      );
      expect(announce).not.toHaveBeenCalled();
    });

    it("gives the error a live region on Android instead of announcing", async () => {
      jest.replaceProperty(Platform, "OS", "android");
      await renderWithProviders(<ErrorState />);
      expect(announce).not.toHaveBeenCalled();
      expect(screen.getByText(uiCopy.error.description)).toHaveProp(
        "accessibilityLiveRegion",
        "polite",
      );
    });
  });
});
