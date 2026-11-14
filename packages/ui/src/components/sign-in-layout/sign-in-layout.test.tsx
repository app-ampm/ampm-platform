import type * as ReactModule from "react";
import { useState } from "react";
import { Text, TextInput } from "react-native";

import { act, classes, fireEvent, renderWithProviders, screen, within } from "../../test/render";
import { SignInLayout } from "./sign-in-layout";
import { useSignInLayoutMode } from "./use-sign-in-layout-mode";

// The window's width picks the arrangement: P1 below 768, one card to 1023, D1's split from 1024.
const mockWindow = { width: 1440, listeners: new Set<() => void>() };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const react = jest.requireActual<typeof ReactModule>("react");
  const subscribe = (listener: () => void) => {
    mockWindow.listeners.add(listener);
    return () => mockWindow.listeners.delete(listener);
  };
  return {
    __esModule: true,
    default: function useMockWindowDimensions() {
      const width = react.useSyncExternalStore(subscribe, () => mockWindow.width);
      return { width, height: 900, scale: 2, fontScale: 1 };
    },
  };
});

/** Resizes the window as a real resize does: only the components that read it re-render. */
async function resizeTo(width: number) {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

const className = (testID: string) =>
  classes(screen.getByTestId(testID, { includeHiddenElements: true }).props.className);

function Mode() {
  return <Text>{`mode ${useSignInLayoutMode()}`}</Text>;
}

/** A form slot that keeps what was typed in its own state, as the sign-in forms do. */
function Field() {
  const [value, setValue] = useState("");
  return <TextInput accessibilityLabel="Mobile number" value={value} onChangeText={setValue} />;
}

const renderLayout = () =>
  renderWithProviders(
    <SignInLayout
      testID="sign-in"
      brand={<Text>AMPM</Text>}
      hero={<Text>Welcome back.</Text>}
      cardTitle="Client sign-in"
      card={<Text>Mobile number</Text>}
      aside={
        <>
          <Text>Work email</Text>
          <Mode />
        </>
      }
      footer="No sign-up · AMPM invites every client"
    />,
  );

describe("SignInLayout", () => {
  it("lays D1's split from 1024: the headline column beside the form column", async () => {
    mockWindow.width = 1440;
    await renderLayout();
    expect(className("sign-in-columns")).toContain("flex-row");
    const columns = within(screen.getByTestId("sign-in-columns"));
    expect(columns.getByTestId("sign-in-hero")).toBeOnTheScreen();
    expect(columns.getByTestId("sign-in-form")).toBeOnTheScreen();
    expect(className("sign-in-hero")).toEqual(
      expect.arrayContaining(["justify-between", "lg:px-18", "lg:py-14"]),
    );
    expect(className("sign-in-form")).toEqual(
      expect.arrayContaining(["items-center", "justify-center", "lg:p-14"]),
    );
    // Both columns fill at least the first view from the top, so a long form never stretches the
    // headline column.
    expect(className("sign-in-columns")).toContain("items-start");
    expect(screen.getByTestId("sign-in-hero").props.style).toEqual({ minHeight: 900 });
    expect(screen.getByTestId("sign-in-form").props.style).toEqual({ minHeight: 900 });
    // The screen's own gutters give way to the columns' padding, inside the 1440 frame.
    expect(className("sign-in-content")).toEqual(
      expect.arrayContaining(["lg:p-0", "lg:max-w-frame", "grow"]),
    );
  });

  it("keeps only the title and the form in the split's card, the rest under it", async () => {
    mockWindow.width = 1440;
    await renderLayout();
    const card = within(screen.getByTestId("sign-in-card"));
    expect(className("sign-in-card")).toEqual(
      expect.arrayContaining(["max-w-lg", "lg:p-11", "lg:rounded-2xl"]),
    );
    expect(card.getByRole("header", { name: "Client sign-in" })).toBeOnTheScreen();
    expect(card.getByText("Mobile number")).toBeOnTheScreen();
    expect(card.queryByText("Welcome back.")).toBeNull();
    expect(card.queryByText("Work email")).toBeNull();
    expect(within(screen.getByTestId("sign-in-aside")).getByText("Work email")).toBeOnTheScreen();
    expect(screen.getByText("mode split")).toBeOnTheScreen();
    expect(
      within(screen.getByTestId("sign-in-hero")).getByText(
        "No sign-up · AMPM invites every client",
      ),
    ).toBeOnTheScreen();
  });

  it("holds everything in one centred glass card from 768 to 1023, with no foot eyebrow", async () => {
    mockWindow.width = 900;
    await renderLayout();
    expect(className("sign-in-columns")).toEqual(expect.arrayContaining(["flex-col", "gap-6"]));
    const frame = within(screen.getByTestId("sign-in-frame"));
    expect(className("sign-in-frame")).toEqual(
      expect.arrayContaining(["border", "p-6", "max-w-md", "md:p-9"]),
    );
    expect(frame.getByText("AMPM")).toBeOnTheScreen();
    expect(frame.getByText("Welcome back.")).toBeOnTheScreen();
    expect(frame.getByText("Client sign-in")).toBeOnTheScreen();
    expect(frame.queryByRole("header", { name: "Client sign-in" })).toBeNull();
    expect(frame.getByText("Work email")).toBeOnTheScreen();
    expect(frame.getByText("mode card")).toBeOnTheScreen();
    // Inside the glass card the form is bare: only top-level panels are glass.
    expect(className("sign-in-card")).not.toContain("border");
    expect(screen.queryByText("No sign-up · AMPM invites every client")).toBeNull();
  });

  it("heads a phone screen with the headline, the form card and the rest after it (P1)", async () => {
    mockWindow.width = 390;
    await renderLayout();
    const content = screen.getByTestId("sign-in-content");
    expect(within(content).getByText("Welcome back.")).toBeOnTheScreen();
    const card = within(screen.getByTestId("sign-in-card"));
    expect(card.queryByText("Welcome back.")).toBeNull();
    expect(card.getByText("Client sign-in")).toBeOnTheScreen();
    expect(card.queryByText("Work email")).toBeNull();
    expect(screen.getByText("mode phone")).toBeOnTheScreen();
    expect(className("sign-in-card")).toEqual(expect.arrayContaining(["border", "p-5"]));
    expect(className("sign-in-frame")).not.toContain("border");
    expect(screen.queryByText("No sign-up · AMPM invites every client")).toBeNull();
  });

  it("keeps what the form holds when the window crosses 768 and 1024", async () => {
    mockWindow.width = 900;
    await renderWithProviders(
      <SignInLayout testID="sign-in" hero={<Text>Welcome back.</Text>} card={<Field />} />,
    );
    await fireEvent.changeText(screen.getByLabelText("Mobile number"), "98765 43210");

    // A tablet turning to landscape, then a window narrowed to a phone's width, then back.
    for (const [width, direction] of [
      [1180, "flex-row"],
      [390, "flex-col"],
      [900, "flex-col"],
    ] as const) {
      await resizeTo(width);
      expect(className("sign-in-columns")).toContain(direction);
      expect(screen.getByLabelText("Mobile number").props.value).toBe("98765 43210");
    }
    expect(className("sign-in-frame")).toContain("max-w-md");
  });
});
