import { Platform } from "react-native";

import { colors } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { spyOnAnnounce } from "../../test/announce";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { EmptyState } from "../empty-state";
import { ErrorState } from "../error-state";
import { glassRecipes } from "../glass-panel";
import { OfflineState } from "../offline-state";
import { StateView } from "./state-view";
import { stateIconStyles } from "./state-view.styles";

interface Region {
  readonly prop: "accessibilityRole" | "accessibilityLiveRegion";
  readonly value: string;
}
const ALERT: Region = { prop: "accessibilityRole", value: "alert" };
const LIVE_REGION: Region = { prop: "accessibilityLiveRegion", value: "polite" };

/**
 * The nearest element at or above the text that is the alert or live region. Walked by hand: the
 * group is a plain View, not an accessibility element (that would merge the heading into one
 * VoiceOver element), so getByRole does not match it.
 */
function regionAround(text: string, { prop, value }: Region) {
  let node: ReturnType<typeof screen.getByText> | null = screen.getByText(text);
  while (node && node.props[prop] !== value) node = node.parent;
  return node;
}

describe("state views", () => {
  it("draws the state on base glass, centred, with the icon in a pearl disc", async () => {
    await renderWithProviders(
      <StateView
        icon="inbox"
        title="No hotels found"
        description="Try a different search."
        testID="state"
      />,
    );
    const panel = classes(screen.getByTestId("state").props.className);
    expect(panel).toEqual(
      expect.arrayContaining([
        glassRecipes.base.stroke,
        "rounded-xl",
        "p-6",
        "items-center",
        "gap-3",
      ]),
    );
    const tree = JSON.stringify(screen.toJSON());
    expect(tree).toContain(glassRecipes.base.fill);
    expect(tree).toContain(stateIconStyles);
    expect(stateIconStyles).toContain("bg-primary/8");
    expect(stateIconStyles).toContain("border-primary/16");
    expect(classes(screen.getByText("Try a different search.").props.className)).toContain(
      "text-body",
    );
  });

  it("goes flat inside another panel", async () => {
    await renderWithProviders(<StateView icon="inbox" title="Nothing yet" />);
    expect(JSON.stringify(screen.toJSON())).toContain("ExpoBlur");
    await renderWithProviders(<StateView icon="inbox" title="Nothing yet" blur={false} />);
    expect(JSON.stringify(screen.toJSON())).not.toContain("ExpoBlur");
  });

  it("keeps the action secondary unless the screen makes it its gold primary", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <StateView icon="inbox" title="No requests" action={{ label: "New request", onPress }} />,
    );
    expect(
      classes(screen.getByRole("button", { name: "New request" }).props.className),
    ).not.toContain("bg-brand");
    await renderWithProviders(
      <StateView
        icon="inbox"
        title="No requests"
        action={{ label: "Add hotel", onPress, variant: "primary" }}
      />,
    );
    expect(classes(screen.getByRole("button", { name: "Add hotel" }).props.className)).toContain(
      "bg-brand",
    );
  });

  it("colours the icon per state: pearl empty, gold error, peacock offline", async () => {
    await renderWithProviders(<EmptyState title="No requests yet" />);
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors.primary.light}"`);
    await renderWithProviders(<ErrorState />);
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors.brand.light}"`);
    await renderWithProviders(<OfflineState />);
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors.highlight.light}"`);
  });

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
    expect(regionAround(uiCopy.error.title, ALERT)).not.toBeNull();
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
      expect(regionAround(uiCopy.offline.title, ALERT)).toBeNull();
      expect(regionAround(uiCopy.offline.description, ALERT)).toBeNull();
    });

    // Announcing (ui.md) a surface hidden from VoiceOver makes it speak what the user cannot reach.
    it("keeps a hidden error state and a hidden offline state silent", async () => {
      await renderWithProviders(<ErrorState accessibilityElementsHidden />);
      await renderWithProviders(<OfflineState style={{ display: "none" }} />);
      await renderWithProviders(<ErrorState aria-hidden />);
      await renderWithProviders(<ErrorState className="hidden" />);
      await renderWithProviders(<OfflineState className="hidden" />);
      expect(announce).not.toHaveBeenCalled();
    });

    it("keeps the empty state silent", async () => {
      await renderWithProviders(
        <EmptyState title="No requests yet" description="They appear here." />,
      );
      expect(announce).not.toHaveBeenCalled();
    });

    // iOS speaks the title and the description (useAnnounce), so the web alert and the Android
    // live region must cover both too, or each platform says something different.
    it("puts the title and the description in the alert", async () => {
      await renderWithProviders(<ErrorState />);
      const alert = regionAround(uiCopy.error.title, ALERT);
      expect(alert).not.toBeNull();
      expect(regionAround(uiCopy.error.description, ALERT)).toBe(alert);
    });

    it("still alerts with the title when there is no description", async () => {
      await renderWithProviders(<StateView icon="alert-triangle" title="Upload failed" announce />);
      expect(regionAround("Upload failed", ALERT)).not.toBeNull();
    });

    it("gives the error a live region on Android over its title and description", async () => {
      jest.replaceProperty(Platform, "OS", "android");
      await renderWithProviders(<ErrorState />);
      expect(announce).not.toHaveBeenCalled();
      const region = regionAround(uiCopy.error.title, LIVE_REGION);
      expect(region).not.toBeNull();
      expect(regionAround(uiCopy.error.description, LIVE_REGION)).toBe(region);
    });
  });
});
