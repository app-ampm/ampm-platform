import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Text } from "../text";
import { ScreenHeader } from "./screen-header";
import { screenHeaderStyles } from "./screen-header.styles";

describe("ScreenHeader", () => {
  it("reads the title and its gold word as one heading", async () => {
    await renderWithProviders(<ScreenHeader title="Welcome" emphasis="back." />);
    expect(screen.getByRole("header", { name: "Welcome back." })).toBeOnTheScreen();
    expect(screen.getAllByRole("header")).toHaveLength(1);
    expect(String(screen.getByText("back.").props.className)).toContain("text-brand");
    expect(String(screen.getByText("back.").props.className)).toContain("font-display");
  });

  it("sets the eyebrow over the title and the subtitle in pearl 80%", async () => {
    await renderWithProviders(
      <ScreenHeader
        eyebrow="Friday · 6 Nov 2026"
        title="Good morning, Eva."
        subtitle="Four functions this week."
      />,
    );
    expect(screen.getByRole("header", { name: "Good morning, Eva." })).toBeOnTheScreen();
    expect(String(screen.getByText("Friday · 6 Nov 2026").props.className)).toContain(
      "tracking-eyebrow",
    );
    expect(String(screen.getByText("Four functions this week.").props.className)).toContain(
      "text-body",
    );
  });

  it("shows a back button only when there is somewhere to go back to", async () => {
    const onBack = jest.fn();
    const { rerender } = await renderWithProviders(<ScreenHeader title="Raj Niwas Palace" />);
    expect(screen.queryByRole("button")).toBeNull();
    await rerender(<ScreenHeader title="Raj Niwas Palace" onBack={onBack} />);
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("names the back button by its label", async () => {
    await renderWithProviders(
      <ScreenHeader title="Approvals" onBack={() => undefined} backLabel="Back to home" />,
    );
    expect(screen.getByRole("button", { name: "Back to home" })).toBeOnTheScreen();
  });

  it("puts the trailing element at the right of the title row", async () => {
    await renderWithProviders(
      <ScreenHeader title="Find your venue" trailing={<Text testID="trailing">AS</Text>} />,
    );
    const title = screen.getByRole("header", { name: "Find your venue" });
    const trailing = screen.getByTestId("trailing");
    // Same row: the title's row holds the trailing element's wrapper.
    expect(title.parent?.children).toContain(trailing.parent);
    expect(String(trailing.parent?.props.className)).toContain("shrink-0");
  });

  it("sizes the title for app screens or wide pages, with responsive classes", async () => {
    await renderWithProviders(
      <>
        <ScreenHeader title="My wedding" />
        <ScreenHeader
          title="Where shall we look"
          emphasis="today?"
          size="display"
          titleClassName="md:text-7xl"
        />
      </>,
    );
    expect(String(screen.getByText("My wedding").props.className)).toContain("text-4xl");
    const wide = String(
      screen.getByRole("header", { name: "Where shall we look today?" }).props.className,
    );
    expect(wide).toContain("text-6xl");
    expect(wide).toContain("md:text-7xl");
    expect(String(screen.getByText("today?").props.className)).toContain("md:text-7xl");
    expect(screenHeaderStyles({ size: "display" })).toContain("md:gap-6");
  });
});
