import type * as ReactModule from "react";
import { useState } from "react";
import { Text, TextInput } from "react-native";

import { act, classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Sheet } from "./sheet";

// The window's width, not the platform, decides between the bottom sheet and the centred dialog. The
// mock tells its readers when the width changes, as a real resize does, so a test can cross 768.
const mockWindow = { width: 390, listeners: new Set<() => void>() };
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

async function resizeTo(width: number) {
  await act(() => {
    mockWindow.width = width;
    mockWindow.listeners.forEach((listener) => listener());
  });
}

/** A field inside the sheet whose text lives in its own state, as an edit form's would. */
function NoteField() {
  const [note, setNote] = useState("");
  return (
    <>
      <TextInput value={note} onChangeText={setNote} placeholder="Note" />
      <Text>{`Typed: ${note}`}</Text>
    </>
  );
}

function NoteSheet() {
  return (
    <Sheet open onClose={() => undefined} title="Edit note" testID="sheet">
      <NoteField />
    </Sheet>
  );
}

const panelClasses = () => classes(screen.getByTestId("sheet-panel").props.className);

describe("Sheet by width", () => {
  beforeEach(() => {
    mockWindow.width = 390;
  });

  it("slides up from the bottom edge below 768, with the handle and the phone's 18 inside", async () => {
    await renderWithProviders(<NoteSheet />);
    expect(panelClasses()).toEqual(expect.arrayContaining(["rounded-t-2xl", "border-t", "px-4.5"]));
    expect(JSON.stringify(screen.toJSON())).toContain("bg-primary/26");
  });

  it("is a centred dialog from 768: the full border, radius 28, 24 inside and no handle", async () => {
    mockWindow.width = 820;
    await renderWithProviders(<NoteSheet />);
    expect(panelClasses()).toEqual(expect.arrayContaining(["rounded-2xl", "max-w-lg", "px-6"]));
    expect(panelClasses()).not.toContain("border-t");
    expect(JSON.stringify(screen.toJSON())).not.toContain("bg-primary/26");
  });

  it("keeps what was typed when the window crosses 768, both ways", async () => {
    await renderWithProviders(<NoteSheet />);
    await fireEvent.changeText(screen.getByPlaceholderText("Note"), "Lakeview, please");
    await resizeTo(1024);
    expect(panelClasses()).toContain("max-w-lg");
    expect(screen.getByText("Typed: Lakeview, please")).toBeOnTheScreen();
    await resizeTo(390);
    expect(panelClasses()).toContain("rounded-t-2xl");
    expect(screen.getByDisplayValue("Lakeview, please")).toBeOnTheScreen();
  });
});
