import type { ReactElement } from "react";
import { RefreshControl, Text } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { classes, fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { TabBar } from "../tab-bar";
import { keyboardAvoidance, Screen } from "./screen";
import { ScreenFrameProvider } from "./screen-frame";
import { screenContentStyles, screenFooterContentStyles } from "./screen.styles";

const IPHONE = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, bottom: 34, left: 0, right: 0 },
};

/** Renders under a notched phone's safe area (the jest mock reads the provider's metrics). */
const onPhone = (ui: ReactElement) =>
  renderWithProviders(<SafeAreaProvider initialMetrics={IPHONE}>{ui}</SafeAreaProvider>);

/** A rendered element's classes, matched whole: "pt-4" never passes on "pt-4.5". */
const className = (testID: string) =>
  classes(screen.getByTestId(testID, { includeHiddenElements: true }).props.className);

describe("Screen", () => {
  it("lays its children on the midnight canvas, in the phone gutter", async () => {
    await renderWithProviders(
      <Screen testID="screen" header={<Text>Find your venue</Text>}>
        <Text>My selection</Text>
      </Screen>,
    );
    expect(screen.getByText("Find your venue")).toBeOnTheScreen();
    expect(screen.getByText("My selection")).toBeOnTheScreen();
    expect(className("screen")).toContain("bg-surface");
    expect(className("screen-content")).toEqual(
      expect.arrayContaining(["px-4.5", "md:px-8", "lg:px-12", "pt-4", "pb-10", "gap-4"]),
    );
    // The header is the column's first child, so it scrolls with the content.
    expect(screen.getByTestId("screen-content").children[0]).toBe(
      screen.getByText("Find your venue"),
    );
  });

  it("draws the glow orbs behind everything, or none", async () => {
    const { rerender } = await renderWithProviders(<Screen testID="screen" />);
    expect(className("screen-glow")).toEqual(expect.arrayContaining(["absolute", "inset-0"]));
    expect(screen.getByTestId("screen").children[0]).toBe(
      screen.getByTestId("screen-glow", { includeHiddenElements: true }),
    );
    await rerender(<Screen testID="screen" glow="none" />);
    expect(screen.queryByTestId("screen-glow", { includeHiddenElements: true })).toBeNull();
  });

  it("scrolls by default and keeps button taps working under the keyboard", async () => {
    const onRefresh = jest.fn();
    await renderWithProviders(
      <Screen
        testID="screen"
        refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
      />,
    );
    const scroll = screen.getByTestId("screen-scroll");
    expect(scroll).toHaveProp("keyboardShouldPersistTaps", "handled");
    expect(scroll.props.refreshControl).toBeTruthy();
    expect(screen.queryByTestId("screen-body")).toBeNull();
  });

  it("fills the window without scrolling", async () => {
    await renderWithProviders(
      <Screen testID="screen" scroll={false}>
        <Text>Chat</Text>
      </Screen>,
    );
    expect(screen.queryByTestId("screen-scroll")).toBeNull();
    expect(screen.getByTestId("screen-body")).toBeOnTheScreen();
    expect(className("screen-content")).toContain("flex-1");
    expect(screen.getByText("Chat")).toBeOnTheScreen();
  });

  it("keeps the top safe area and the home indicator clear", async () => {
    await onPhone(<Screen testID="screen" />);
    expect(screen.getByTestId("screen-main")).toHaveStyle({ paddingTop: 47 });
    expect(screen.getByTestId("screen-inset")).toHaveStyle({ height: 34 });
  });

  it("pins a footer on glass above the home indicator", async () => {
    const onPress = jest.fn();
    await onPhone(
      <Screen testID="screen" footer={<Text onPress={onPress}>Check availability</Text>}>
        <Text>Raj Niwas Palace</Text>
      </Screen>,
    );
    await fireEvent.press(screen.getByText("Check availability"));
    expect(onPress).toHaveBeenCalled();
    expect(className("screen-footer")).toEqual(
      expect.arrayContaining(["border-x-0", "border-b-0"]),
    );
    const inset = screen.getByTestId("screen-footer").children.at(-1);
    expect(inset).toHaveStyle({ paddingBottom: 34 });
    // The footer takes the home indicator, so the content does not keep room for it as well.
    expect(screen.queryByTestId("screen-inset")).toBeNull();
    expect(className("screen-content")).toContain("pb-10");
  });

  it("floats the tab bar over the content and keeps room for it", async () => {
    const tabs = [
      { key: "home", label: "Home" },
      { key: "more", label: "More" },
    ];
    await renderWithProviders(
      <Screen
        testID="screen"
        tabBar={<TabBar items={tabs} activeKey="home" onSelect={() => undefined} testID="tabs" />}
      >
        <Text>Updates</Text>
      </Screen>,
    );
    // The real bar floats (absolute) over the stage; the content ends 112 (pb-28) above the edge:
    // the 58 bar, its 26 from the bottom and air between them.
    expect(screen.getByRole("tab", { name: "Home" })).toBeSelected();
    expect(className("tabs")).toContain("absolute");
    expect(className("screen-content")).toContain("pb-28");
    expect(className("screen-content")).not.toContain("pb-10");
    expect(classes(screenContentStyles({ room: "tabBar" }))).toContain("pb-28");
    // From 768 the chrome draws the navigation instead of the bar: no room kept for it.
    expect(classes(screenContentStyles({ room: "tabBar" }))).toContain("md:pb-10");
  });

  it("centres a reading column, and gives desktop pages the artboard frame", async () => {
    expect(classes(screenContentStyles({ width: "content" }))).toEqual(
      expect.arrayContaining(["max-w-3xl", "self-center"]),
    );
    // Under the portal's navigation (or none): the 1440 frame, 72 at the sides (32 for split).
    expect(classes(screenContentStyles({ width: "wide", frame: "topNav" }))).toEqual(
      expect.arrayContaining(["max-w-frame", "self-center", "md:px-8", "lg:px-18", "lg:pt-10"]),
    );
    expect(classes(screenContentStyles({ width: "split", frame: "topNav" }))).toEqual(
      expect.arrayContaining(["max-w-frame", "self-center", "md:px-8", "lg:pt-6"]),
    );
    expect(classes(screenContentStyles({ width: "split", frame: "topNav" }))).not.toContain(
      "lg:px-18",
    );
    expect(classes(screenContentStyles({ width: "wide" }))).toContain("lg:px-18");
    // Beside the rail: the page fills the window, 18 from the rail and 30 at the right and the top.
    const besideRail = classes(screenContentStyles({ width: "wide", frame: "rail" }));
    expect(besideRail).toEqual(expect.arrayContaining(["md:pl-4.5", "md:pr-7.5", "md:pt-7.5"]));
    expect(besideRail).not.toContain("max-w-frame");
    expect(besideRail).not.toContain("self-center");
    expect(screenContentStyles({ width: "full" })).not.toContain("max-w");
    expect(classes(screenFooterContentStyles({ width: "content" }))).toContain("max-w-3xl");
    expect(classes(screenFooterContentStyles({ width: "wide", frame: "rail" }))).toEqual(
      expect.arrayContaining(["md:pl-4.5", "md:pr-7.5"]),
    );
    await renderWithProviders(
      <Screen testID="screen" width="content" contentClassName="gap-6" className="pt-2" />,
    );
    expect(className("screen-content")).toContain("max-w-3xl");
    expect(className("screen-content")).toContain("gap-6");
    expect(className("screen-content")).not.toContain("gap-4");
    expect(className("screen")).toContain("pt-2");
  });

  it("reads its frame from the chrome around it", async () => {
    await renderWithProviders(
      <ScreenFrameProvider frame="rail">
        <Screen testID="screen" width="wide" />
      </ScreenFrameProvider>,
    );
    expect(className("screen-content")).toContain("md:pr-7.5");
    expect(className("screen-content")).not.toContain("max-w-frame");
  });

  it("keeps the footer above the keyboard, inside the avoiding view with the content", async () => {
    await renderWithProviders(
      <Screen testID="screen" footer={<Text>Send request</Text>}>
        <Text>Your details</Text>
      </Screen>,
    );
    const keyboard = screen.getByTestId("screen-keyboard");
    expect(within(keyboard).getByTestId("screen-footer")).toBeOnTheScreen();
    expect(within(keyboard).getByText("Your details")).toBeOnTheScreen();
    // The avoiding view lifts the footer, so iOS does not inset the scroll view as well.
    expect(screen.getByTestId("screen-scroll")).toHaveProp(
      "automaticallyAdjustKeyboardInsets",
      false,
    );
  });

  it("lets iOS inset a footer-less scroll view for the keyboard instead", async () => {
    await renderWithProviders(
      <Screen testID="screen">
        <Text>Your details</Text>
      </Screen>,
    );
    expect(screen.getByTestId("screen-scroll")).toHaveProp(
      "automaticallyAdjustKeyboardInsets",
      true,
    );
  });

  it("makes room for the keyboard one way per platform, never twice", () => {
    // iOS: its own scroll insets for a plain scrolling form; padding when a footer or a fixed screen
    // needs lifting.
    expect(keyboardAvoidance("ios", true, false)).toEqual({
      behavior: "padding",
      enabled: false,
      adjustScrollInsets: true,
    });
    expect(keyboardAvoidance("ios", true, true)).toMatchObject({
      enabled: true,
      behavior: "padding",
    });
    expect(keyboardAvoidance("ios", false, false)).toMatchObject({
      enabled: true,
      adjustScrollInsets: false,
    });
    // Android's edge-to-edge window no longer resizes for the keyboard: the view shrinks instead.
    expect(keyboardAvoidance("android", true, false)).toEqual({
      behavior: "height",
      enabled: true,
      adjustScrollInsets: false,
    });
    // The browser resizes its own viewport.
    expect(keyboardAvoidance("web", true, true)).toMatchObject({ enabled: false });
  });
});
