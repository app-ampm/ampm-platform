import { Platform, type ViewStyle } from "react-native";

import { colors } from "@ampm/tokens";

import { uiCopy } from "../../copy";
import { spyOnAnnounce } from "../../test/announce";
import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { glassRecipes, type GlassRecipeName } from "../glass-panel";
import { Callout, calloutKinds, type CalloutKind } from "./callout";

const DISPLAY_NONE: ViewStyle = { display: "none" };

const KINDS: readonly CalloutKind[] = [
  "indicative",
  "requested",
  "verified",
  "awaiting-confirmation",
  "offline",
  "pending-sync",
  "info",
  "success",
  "warning",
  "danger",
];

/** Which glass each kind wears (docs/design/peacock-night.md §6, Callout). */
const RECIPE: Record<CalloutKind, GlassRecipeName> = {
  indicative: "base",
  info: "base",
  requested: "gold",
  "awaiting-confirmation": "gold",
  warning: "gold",
  danger: "gold",
  verified: "peacock",
  success: "peacock",
  offline: "peacock",
  "pending-sync": "peacock",
};

describe("Callout", () => {
  it("covers every kind", () => {
    expect(Object.keys(calloutKinds).sort()).toEqual([...KINDS].sort());
  });

  it.each(KINDS)("titles the %s kind from the copy table", async (kind) => {
    await renderWithProviders(<Callout kind={kind}>Body</Callout>);
    expect(screen.getByText(uiCopy.callout[kind])).toBeOnTheScreen();
  });

  it.each(KINDS)("draws the %s kind on its glass", async (kind) => {
    const recipe = glassRecipes[RECIPE[kind]];
    expect(calloutKinds[kind].recipe).toBe(RECIPE[kind]);
    await renderWithProviders(<Callout kind={kind} testID="callout" />);
    expect(screen.getByTestId("callout").props.className).toContain(recipe.stroke);
    expect(screen.getByTestId("callout").props.className).toContain("rounded-lg");
    expect(JSON.stringify(screen.toJSON())).toContain(recipe.fill);
  });

  it("puts a gold icon on gold glass and a pearl one elsewhere", async () => {
    await renderWithProviders(<Callout kind="awaiting-confirmation">Body</Callout>);
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors.brand.light}"`);
    await renderWithProviders(<Callout kind="verified">Body</Callout>);
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors.primary.light}"`);
    expect(JSON.stringify(screen.toJSON())).not.toContain(`"stroke":"${colors.brand.light}"`);
  });

  it("blurs as a top-level panel and goes flat when nested", async () => {
    await renderWithProviders(<Callout kind="indicative">Top level</Callout>);
    expect(JSON.stringify(screen.toJSON())).toContain("ExpoBlur");
    await renderWithProviders(
      <Callout kind="indicative" blur={false}>
        Nested
      </Callout>,
    );
    expect(JSON.stringify(screen.toJSON())).not.toContain("ExpoBlur");
  });

  it("lets the title be overridden and the gold action pressed", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Callout kind="pending-sync" title="3 changes waiting" action={{ label: "Retry", onPress }}>
        They are sent when you are online.
      </Callout>,
    );
    expect(screen.getByText("3 changes waiting")).toBeOnTheScreen();
    const action = screen.getByRole("button", { name: "Retry" });
    // A 44px target even though the row is one line tall.
    expect(action.props.className).toContain("min-h-touch");
    expect(screen.getByText("Retry").props.className).toContain("text-brand");
    await fireEvent.press(action);
    expect(onPress).toHaveBeenCalled();
  });

  it("announces danger as an alert", async () => {
    await renderWithProviders(<Callout kind="danger">Nothing was charged.</Callout>);
    expect(screen.getByRole("alert")).toBeOnTheScreen();
  });

  it("announces the live kinds on iOS with their title and body", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Callout kind="danger">Nothing was charged.</Callout>);
    expect(announce).toHaveBeenCalledWith(`${uiCopy.callout.danger}. Nothing was charged.`, {
      queue: true,
    });
    jest.restoreAllMocks();
  });

  // Android speaks a live kind through its own live region; iOS and the web through useAnnounce
  // (VoiceOver, the page's live region), so the callout carries none of its own there.
  it("gives the live kinds a polite live region on Android, and the static kinds none", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    await renderWithProviders(<Callout kind="offline" testID="live" />);
    expect(screen.getByTestId("live")).toHaveProp("accessibilityLiveRegion", "polite");
    await renderWithProviders(<Callout kind="verified" testID="static" />);
    expect(screen.getByTestId("static")).not.toHaveProp("accessibilityLiveRegion");
    jest.restoreAllMocks();
    jest.replaceProperty(Platform, "OS", "web");
    await renderWithProviders(<Callout kind="pending-sync" testID="web" />);
    expect(screen.getByTestId("web")).not.toHaveProp("accessibilityLiveRegion");
    jest.restoreAllMocks();
  });

  // Announcing (ui.md) a surface hidden from VoiceOver makes it speak what the user cannot reach.
  it.each([
    { accessibilityElementsHidden: true },
    { "aria-hidden": true },
    { style: DISPLAY_NONE },
    { className: "hidden" },
    // Platform variants as styling.md writes them: display none on iOS, so silent there.
    { className: "hidden web:flex" },
    { className: "native:hidden" },
    { className: "ios:hidden" },
  ])("keeps a live kind silent while hidden from VoiceOver (%o)", async (hiding) => {
    const announce = spyOnAnnounce();
    await renderWithProviders(
      <Callout kind="danger" {...hiding}>
        Hidden.
      </Callout>,
    );
    expect(announce).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("still announces on iOS when only TalkBack is told to skip it (an Android-only prop)", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(
      <Callout kind="danger" importantForAccessibility="no-hide-descendants">
        Nothing was charged.
      </Callout>,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it("keeps the static kinds silent", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Callout kind="indicative">Rates verified on 12 March.</Callout>);
    expect(announce).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
