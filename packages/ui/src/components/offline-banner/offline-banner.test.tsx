import { Platform, type ViewStyle } from "react-native";

import { uiCopy } from "../../copy";
import { spyOnAnnounce } from "../../test/announce";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { glassRecipes } from "../glass-panel";
import { OfflineBanner } from "./offline-banner";
import { offlineBannerDotStyles } from "./offline-banner.styles";

const DISPLAY_NONE: ViewStyle = { display: "none" };

describe("OfflineBanner", () => {
  it("says how many updates are queued and that they sync later", async () => {
    await renderWithProviders(<OfflineBanner queuedCount={3} />);
    expect(screen.getByText("Offline · 3 updates queued")).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.offlineBanner.description)).toBeOnTheScreen();
    // Read with a pause, not "middle dot".
    expect(screen.getByLabelText("Offline, 3 updates queued")).toBeOnTheScreen();
  });

  it("counts one update in the singular", async () => {
    await renderWithProviders(<OfflineBanner queuedCount={1} />);
    expect(screen.getByText("Offline · 1 update queued")).toBeOnTheScreen();
  });

  it("shows the title alone, and a fitting second line, with nothing queued", async () => {
    await renderWithProviders(<OfflineBanner />);
    expect(screen.getByText(uiCopy.offlineBanner.title)).toBeOnTheScreen();
    expect(screen.getByText(uiCopy.offlineBanner.idleDescription)).toBeOnTheScreen();
    expect(screen.queryByText(uiCopy.offlineBanner.description)).toBeNull();
  });

  it("takes its strings as props", async () => {
    await renderWithProviders(
      <OfflineBanner queuedCount={2} title="No signal" description="Nothing is lost." />,
    );
    expect(screen.getByText("No signal · 2 updates queued")).toBeOnTheScreen();
    expect(screen.getByText("Nothing is lost.")).toBeOnTheScreen();
  });

  it("is a peacock glass pill with a pearl dot, a bold pearl title and pearl 80% text", async () => {
    await renderWithProviders(<OfflineBanner queuedCount={3} testID="banner" />);
    const pill = classes(screen.getByTestId("banner").props.className);
    expect(pill).toEqual(
      expect.arrayContaining([glassRecipes.peacock.stroke, "rounded-full", "px-4", "py-2.5"]),
    );
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain(glassRecipes.peacock.fill);
    expect(tree).toContain(offlineBannerDotStyles);
    expect(classes(offlineBannerDotStyles)).toEqual(
      expect.arrayContaining(["h-1.5", "w-1.5", "rounded-full", "bg-primary"]),
    );
    const title = classes(screen.getByText("Offline · 3 updates queued").props.className);
    expect(title).toEqual(expect.arrayContaining(["font-sans-bold", "text-sm", "text-primary"]));
    const body = classes(screen.getByText(uiCopy.offlineBanner.description).props.className);
    expect(body).toEqual(expect.arrayContaining(["text-sm", "text-body"]));
  });

  // Android speaks the banner's own live region. iOS ignores live regions, and on the web a region
  // inserted together with its text is not reliably spoken, so useAnnounce speaks there instead.
  it("is a polite live region on Android only", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    await renderWithProviders(<OfflineBanner queuedCount={3} testID="banner" />);
    expect(screen.getByTestId("banner")).toHaveProp("accessibilityLiveRegion", "polite");
    jest.restoreAllMocks();
    for (const os of ["ios", "web"] as const) {
      jest.replaceProperty(Platform, "OS", os);
      await renderWithProviders(<OfflineBanner queuedCount={3} testID={`banner-${os}`} />);
      expect(screen.getByTestId(`banner-${os}`)).not.toHaveProp("accessibilityLiveRegion");
      expect(screen.getByTestId(`banner-${os}`)).not.toHaveProp("role");
      jest.restoreAllMocks();
    }
  });

  it("offers a gold retry with a 44px target", async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<OfflineBanner queuedCount={3} onRetry={onRetry} />);
    const retry = screen.getByRole("button", { name: uiCopy.retry });
    expect(classes(retry.props.className)).toContain("min-h-touch");
    expect(classes(screen.getByText(uiCopy.retry).props.className)).toContain("text-brand");
    await fireEvent.press(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("has no retry unless asked, and names it as told", async () => {
    await renderWithProviders(<OfflineBanner queuedCount={3} />);
    expect(screen.queryByRole("button")).toBeNull();
    await renderWithProviders(
      <OfflineBanner queuedCount={3} onRetry={() => undefined} retryLabel="Sync now" />,
    );
    expect(screen.getByRole("button", { name: "Sync now" })).toBeOnTheScreen();
  });

  describe("announcements", () => {
    let announce: jest.SpyInstance;
    beforeEach(() => {
      announce = spyOnAnnounce();
    });
    afterEach(() => jest.restoreAllMocks());

    it("announces itself on iOS when it appears, once", async () => {
      await renderWithProviders(<OfflineBanner queuedCount={3} />);
      expect(announce).toHaveBeenCalledTimes(1);
      expect(announce).toHaveBeenCalledWith(
        `Offline. 3 updates queued. ${uiCopy.offlineBanner.description}`,
        { queue: true },
      );
    });

    it("announces again when the queue changes, not on a plain re-render", async () => {
      const { rerender } = await renderWithProviders(<OfflineBanner queuedCount={3} />);
      await rerender(<OfflineBanner queuedCount={3} />);
      expect(announce).toHaveBeenCalledTimes(1);
      await rerender(<OfflineBanner queuedCount={4} />);
      expect(announce).toHaveBeenCalledTimes(2);
      expect(announce).toHaveBeenLastCalledWith(
        `Offline. 4 updates queued. ${uiCopy.offlineBanner.description}`,
        { queue: true },
      );
    });

    // Announcing (ui.md) a surface hidden from VoiceOver makes it speak what the user cannot reach.
    it.each([
      { accessibilityElementsHidden: true },
      { "aria-hidden": true },
      { style: DISPLAY_NONE },
      { className: "hidden" },
      { className: "native:hidden" },
    ])("stays silent while hidden from VoiceOver (%o)", async (hiding) => {
      await renderWithProviders(<OfflineBanner queuedCount={3} {...hiding} />);
      expect(announce).not.toHaveBeenCalled();
    });
  });
});
