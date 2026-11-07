import { Text } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { CreateToggle } from "./consultancy-admin.widgets";
import { TransitionRow } from "./transition-row";

describe("CreateToggle", () => {
  it("swaps its button for the form, and back when the form is done", async () => {
    await renderWithProviders(
      <CreateToggle label="New site visit">
        {(done) => <Text onPress={done}>Visit form</Text>}
      </CreateToggle>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "New site visit" }));
    expect(screen.getByText("Visit form")).toBeOnTheScreen();
    expect(screen.queryByText("New site visit")).toBeNull();
    await fireEvent.press(screen.getByText("Visit form"));
    expect(screen.getByRole("button", { name: "New site visit" })).toBeOnTheScreen();
  });
});

describe("TransitionRow", () => {
  it("renders nothing for a record with no moves left", async () => {
    await renderWithProviders(<TransitionRow nexts={[]} pending={false} onMove={jest.fn()} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("offers each move, in the caller's words when given, and reports the one pressed", async () => {
    const onMove = jest.fn();
    await renderWithProviders(
      <TransitionRow
        nexts={["no_availability", "cancelled"]}
        pending={false}
        onMove={onMove}
        label={(status) => (status === "cancelled" ? "Cancel" : status.replace(/_/g, " "))}
      />,
    );
    expect(screen.getByRole("button", { name: "no availability" })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
    expect(onMove).toHaveBeenCalledWith("cancelled");
  });

  it("keeps every move busy while one is on its way", async () => {
    await renderWithProviders(
      <TransitionRow nexts={["done", "cancelled"]} pending onMove={jest.fn()} />,
    );
    for (const button of screen.getAllByRole("button")) expect(button).toBeBusy();
  });

  it("names each move by the status it reaches, in sentence case", async () => {
    await renderWithProviders(
      <TransitionRow nexts={["no_availability", "cancelled"]} pending={false} onMove={jest.fn()} />,
    );
    expect(screen.getByRole("button", { name: "No availability" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Cancelled" })).toBeOnTheScreen();
  });
});
