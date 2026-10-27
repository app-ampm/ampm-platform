import { Text } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { Row } from "./row";
import { Spacer } from "./spacer";
import { Stack } from "./stack";

describe("layout", () => {
  it("renders children in a Stack and a Row", async () => {
    await renderWithProviders(
      <Stack testID="stack">
        <Row testID="row">
          <Text>a</Text>
          <Spacer testID="spacer" />
          <Text>b</Text>
        </Row>
      </Stack>,
    );
    expect(screen.getByTestId("stack")).toBeOnTheScreen();
    expect(screen.getByTestId("row")).toBeOnTheScreen();
    expect(screen.getByTestId("spacer")).toBeOnTheScreen();
    expect(screen.getByText("b")).toBeOnTheScreen();
  });
});
