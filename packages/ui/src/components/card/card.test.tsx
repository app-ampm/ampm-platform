import { Text } from "react-native";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Card } from "./card";
import { cardStyles } from "./card.styles";

describe("Card", () => {
  it("is a plain surface without onPress", async () => {
    await renderWithProviders(
      <Card testID="card">
        <Text>Taj Lake Palace</Text>
      </Card>,
    );
    expect(screen.getByTestId("card")).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("becomes a button with onPress", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Card onPress={onPress} accessibilityLabel="Open Taj Lake Palace">
        <Text>Taj Lake Palace</Text>
      </Card>,
    );
    await fireEvent.press(screen.getByRole("button", { name: "Open Taj Lake Palace" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("maps padding and elevation to tokens", async () => {
    expect(cardStyles({ padding: "lg" })).toContain("p-6");
    expect(cardStyles({ elevated: true })).toContain("shadow-sm");
    expect(cardStyles({ pressable: true })).toContain("active:bg-surface-inset");
  });
});
