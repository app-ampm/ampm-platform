import { StyleSheet } from "react-native";

import { colors } from "@ampm/tokens";

import { spyOnAnnounce } from "../../test/announce";
import { act, classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Button } from "../button";
import { glassRecipes } from "../glass-panel";
import { DEFAULT_TOAST_DURATION_MS, useToast } from "./toast-provider";
import { toastIcons } from "./toast-viewport";
import type { ToastOptions } from "./toast.types";

const SAVED: ToastOptions = { title: "Saved", description: "All good", tone: "success" };

function Trigger({ sticky = false, toast = SAVED }: { sticky?: boolean; toast?: ToastOptions }) {
  const toasts = useToast();
  return (
    <Button onPress={() => toasts.show({ ...toast, durationMs: sticky ? 0 : toast.durationMs })}>
      Show
    </Button>
  );
}

describe("Toast", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("shows a toast and dismisses it after the default duration", async () => {
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Saved")).toBeOnTheScreen();
    expect(screen.getByText("All good")).toBeOnTheScreen();
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS + 1));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  // A timer left running would fire into a provider that is gone, and keep a test runner's event
  // loop alive after the last test (screen tests raise toasts and end without dismissing them).
  it("clears its timers when it unmounts, so a pending toast never fires afterwards", async () => {
    const errors = jest.spyOn(console, "error");
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("Saved")).toBeOnTheScreen();
    await screen.unmount();
    // Outside act, as a stray timer would run. Short of the toast's due time everything else queued
    // runs (React's microtasks, the entrance animation), so only a toast timer could still wait.
    jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS - 1);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS);
    expect(errors).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("keeps a sticky toast until it is dismissed", async () => {
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS * 3));
    expect(screen.getByText("Saved")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Saved")).toBeNull();
  });

  it("sits on base glass with no stroke accent and no shadow", async () => {
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    const panel = screen.getByTestId("toast-1-panel").props.className;
    expect(panel).toContain(glassRecipes.base.stroke);
    expect(panel).toContain("rounded-lg");
    expect(panel).not.toContain("border-l-4");
    expect(panel).not.toContain("shadow");
    expect(screen.getByText("Saved").props.className).toContain("text-primary");
  });

  it("lets the icon carry the tone: peacock done, gold problems, pearl notes", async () => {
    expect(toastIcons.success.tone).toBe("highlight");
    expect(toastIcons.danger.tone).toBe("brand");
    expect(toastIcons.warning.tone).toBe("brand");
    expect(toastIcons.info.tone).toBe("primary");
    expect(toastIcons.neutral.tone).toBe("primary");
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors.highlight.light}"`);
  });

  // WCAG 2.2.1: a keyboard or screen reader user must be able to reach "View" before it goes.
  it("keeps a toast with an action until it is dismissed, unless given a duration", async () => {
    const action = { label: "View", onPress: jest.fn() };
    await renderWithProviders(<Trigger toast={{ title: "Request sent", action }} />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS * 3));
    expect(screen.getByText("Request sent")).toBeOnTheScreen();
    await renderWithProviders(
      <Trigger toast={{ title: "Copied", action, durationMs: DEFAULT_TOAST_DURATION_MS }} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS + 1));
    expect(screen.queryByText("Copied")).toBeNull();
  });

  // An ancestor below opacity 1 switches the web's backdrop blur off, and an iOS BlurView under a
  // translucent parent draws wrongly: the card rises, its contents fade, the glass never does.
  it("rises the card and fades its contents in, never the glass", async () => {
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    const card = StyleSheet.flatten(screen.getByTestId("toast-1").props.style);
    expect(card).not.toHaveProperty("opacity");
    expect(card).toHaveProperty("transform");
    const content = StyleSheet.flatten(screen.getByTestId("toast-1-content").props.style);
    expect(content).toHaveProperty("opacity");
    expect(classes(screen.getByTestId("toast-1-content").props.className)).toEqual(
      expect.arrayContaining(["flex", "flex-row", "gap-3"]),
    );
  });

  it("runs the gold action and dismisses the toast", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Trigger sticky toast={{ title: "Request sent", action: { label: "View", onPress } }} />,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText("View").props.className).toContain("text-brand");
    await fireEvent.press(screen.getByRole("button", { name: "View" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Request sent")).toBeNull();
  });

  it("stacks toasts newest first", async () => {
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    const ids = screen.getAllByTestId(/^toast-\d+$/).map((card) => card.props.testID);
    expect(ids).toEqual(["toast-2", "toast-1"]);
  });

  it("announces a toast once on iOS when it appears", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS));
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith("Saved. All good", { queue: true });
    jest.restoreAllMocks();
  });

  // A toast speaks when it appears; repeating it as it leaves would talk over what comes next.
  it("stays silent when a toast is dismissed", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await fireEvent.press(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Saved")).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it("stays silent when a timed toast expires", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Trigger />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS + 1));
    expect(screen.queryByText("Saved")).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });
});
