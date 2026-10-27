import { uiCopy } from "../../copy";
import { spyOnAnnounce } from "../../test/announce";
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

  it("announces the live kinds on iOS with their title and body", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Callout kind="danger">Nothing was charged.</Callout>);
    expect(announce).toHaveBeenCalledWith(`${uiCopy.callout.danger}. Nothing was charged.`, {
      queue: true,
    });
    jest.restoreAllMocks();
  });

  // Announcing (ui.md) a surface hidden from VoiceOver makes it speak what the user cannot reach.
  it.each([
    { accessibilityElementsHidden: true },
    { "aria-hidden": true },
    { style: { display: "none" as const } },
    { className: "hidden" },
    // Platform variants as styling.md writes them: display none on iOS, so silent there.
    { className: "hidden web:flex" },
    { className: "native:hidden" },
    { className: "ios:hidden" },
  ])("keeps a live kind silent while hidden from VoiceOver (%o)", async (hiding) => {
    const announce = spyOnAnnounce();
    await renderWithProviders(
      <Callout kind="danger" {...hiding}>
        Hidden.
      </Callout>,
    );
    expect(announce).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });

  it("still announces on iOS when only TalkBack is told to skip it (an Android-only prop)", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(
      <Callout kind="danger" importantForAccessibility="no-hide-descendants">
        Nothing was charged.
      </Callout>,
    );
    expect(announce).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });

  it("keeps the static kinds silent", async () => {
    const announce = spyOnAnnounce();
    await renderWithProviders(<Callout kind="indicative">Rates verified on 12 March.</Callout>);
    expect(announce).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
