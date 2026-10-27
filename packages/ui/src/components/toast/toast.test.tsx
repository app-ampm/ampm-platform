import { act, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Button } from "../button";
import { DEFAULT_TOAST_DURATION_MS, useToast } from "./toast-provider";

function Trigger({ sticky = false }: { sticky?: boolean }) {
  const toast = useToast();
  return (
    <Button
      onPress={() =>
        toast.show({
          title: "Saved",
          description: "All good",
          tone: "success",
          durationMs: sticky ? 0 : undefined,
        })
      }
    >
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

  it("keeps a sticky toast until it is dismissed", async () => {
    await renderWithProviders(<Trigger sticky />);
    await fireEvent.press(screen.getByRole("button", { name: "Show" }));
    await act(() => jest.advanceTimersByTime(DEFAULT_TOAST_DURATION_MS * 3));
    expect(screen.getByText("Saved")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Saved")).toBeNull();
  });
});
