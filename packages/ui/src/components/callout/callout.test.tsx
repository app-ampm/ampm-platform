import { uiCopy } from "../../copy";
import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Callout, calloutKinds, type CalloutKind } from "./callout";

describe("Callout", () => {
  it.each(Object.keys(calloutKinds) as CalloutKind[])(
    "titles the %s kind from the copy table",
    async (kind) => {
      await renderWithProviders(<Callout kind={kind}>Body</Callout>);
      expect(screen.getByText(uiCopy.callout[kind])).toBeOnTheScreen();
    },
  );

  it("lets the title be overridden and the action pressed", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Callout kind="pending-sync" title="3 changes waiting" action={{ label: "Retry", onPress }}>
        They are sent when you are online.
      </Callout>,
    );
    expect(screen.getByText("3 changes waiting")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Retry" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("announces danger as an alert", async () => {
    await renderWithProviders(<Callout kind="danger">Nothing was charged.</Callout>);
    expect(screen.getByRole("alert")).toBeOnTheScreen();
  });
});
