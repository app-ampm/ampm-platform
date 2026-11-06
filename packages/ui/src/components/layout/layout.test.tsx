import { Text } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { Divider } from "./divider";
import { dividerStyles, gapClass, spacerClass } from "./layout.styles";
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

  it("takes Peacock Night's half steps as gaps and spacers", async () => {
    await renderWithProviders(
      <Stack gap={4.5} testID="stack">
        <Row gap={2.5} testID="row">
          <Text>a</Text>
          <Spacer size={3.5} testID="spacer" />
        </Row>
      </Stack>,
    );
    expect(screen.getByTestId("stack").props.className).toContain("gap-4.5");
    expect(screen.getByTestId("row").props.className).toContain("gap-2.5");
    expect(screen.getByTestId("spacer").props.className).toBe("h-3.5");
    expect(gapClass[1.5]).toBe("gap-1.5");
    expect(spacerClass[1.5].horizontal).toBe("w-1.5");
  });
});

describe("Divider", () => {
  it("is a pearl 16% hairline that screen readers skip", async () => {
    await renderWithProviders(<Divider testID="rule" />);
    expect(screen.queryByTestId("rule")).toBeNull();
    const rule = screen.getByTestId("rule", { includeHiddenElements: true });
    expect(rule.props.className).toContain("bg-primary/16");
    expect(rule.props.className).toContain("h-px");
    expect(rule.props.className).toContain("self-stretch");
  });

  it("draws vertical and inset rules from the tokens", async () => {
    await renderWithProviders(<Divider orientation="vertical" inset testID="rule" />);
    const rule = screen.getByTestId("rule", { includeHiddenElements: true });
    expect(rule.props.className).toContain("w-px");
    expect(rule.props.className).toContain("my-2");
    expect(dividerStyles({ inset: true })).toContain("mx-4");
    expect(dividerStyles()).not.toContain("mx-4");
  });

  it("passes the caller's classes through", async () => {
    await renderWithProviders(<Divider className="my-1" testID="rule" />);
    expect(screen.getByTestId("rule", { includeHiddenElements: true }).props.className).toContain(
      "my-1",
    );
  });
});
