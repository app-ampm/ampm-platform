import { uiCopy } from "../../copy";
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
});
