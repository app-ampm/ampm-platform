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

  it("steps a screen title up on a desktop, and sets a hero as D1 does", async () => {
    await renderWithProviders(
      <>
        <ScreenHeader title="Pipeline" />
        <ScreenHeader
          size="hero"
          title="Welcome"
          emphasis="back."
          subtitle="Sign in with the mobile number AMPM has on file."
        />
      </>,
    );
    // 36 on a phone, 44 from 1024 (T 39, D and C 41–68).
    const pipeline = String(screen.getByText("Pipeline").props.className);
    expect(pipeline).toContain("text-4xl");
    expect(pipeline).toContain("lg:text-5xl");
    // The hero: 44 on a phone (P1's 49), 88 from 1024 (D1's 86), and the gold word with it.
    const hero = String(screen.getByRole("header", { name: "Welcome back." }).props.className);
    expect(hero).toContain("font-display");
    expect(hero).toContain("text-5xl");
    expect(hero).toContain("lg:text-7xl");
    expect(String(screen.getByText("back.").props.className)).toContain("lg:text-7xl");
    // Its lead paragraph is D1's 18, a reading line wide at most.
    const lead = String(
      screen.getByText("Sign in with the mobile number AMPM has on file.").props.className,
    );
    expect(lead).toContain("lg:text-xl");
    expect(lead).toContain("lg:max-w-md");
  });

  it("puts the actions beside the text block from 768 and under it on a phone", async () => {
    await renderWithProviders(
      <ScreenHeader title="Pipeline" actions={<Text>New lead</Text>} testID="pipeline-header" />,
    );
    const actions = screen.getByText("New lead").parent;
    expect(String(actions?.props.className)).toContain("flex-wrap");
    // The actions give way (wrapping) before the title drops below its floor on a tablet.
    expect(String(actions?.props.className)).toContain("md:shrink");
    expect(String(actions?.props.className)).not.toContain("shrink-0");
    expect(String(screen.getByRole("header").parent?.parent?.props.className)).toContain(
      "md:min-w-56",
    );
    expect(String(actions?.parent?.props.className)).toContain("md:flex-row");
  });

  it("reads a badge right after the title, not pushed to the far right", async () => {
    await renderWithProviders(
      <ScreenHeader title="Rohit Malhotra" badge={<Text>Demo granted</Text>} />,
    );
    const heading = screen.getByRole("header", { name: "Rohit Malhotra" });
    expect(String(heading.props.className)).not.toContain("flex-1");
    expect(screen.getByText("Demo granted")).toBeOnTheScreen();
  });

  it("sets a record's header on its own glass panel", async () => {
    await renderWithProviders(
      <ScreenHeader variant="panel" title="Rohit Malhotra" testID="record-header" />,
    );
    const panel = screen.getByTestId("record-header");
    expect(String(panel.props.className)).toContain("lg:px-7");
    expect(String(panel.props.className)).toContain("rounded-xl");
  });

  it("keeps a panel's back button in the row beside the title, a plain header's above it", async () => {
    const { rerender } = await renderWithProviders(
      <ScreenHeader variant="panel" title="Prasad & Partner" onBack={jest.fn()} />,
    );
    const inPanel = screen.getByRole("button", { name: "Back" }).parent;
    expect(String(inPanel?.props.className)).toContain("md:flex-row");
    await rerender(<ScreenHeader title="Prasad & Partner" onBack={jest.fn()} />);
    const inPlain = screen.getByRole("button", { name: "Back" }).parent;
    expect(String(inPlain?.props.className)).not.toContain("md:flex-row");
  });
});
