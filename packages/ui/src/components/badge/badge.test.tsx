import { classes, renderWithProviders, screen } from "../../test/render";
import { Badge } from "./badge";
import { badgeLabelStyles, badgeStyles } from "./badge.styles";

describe("Badge", () => {
  it("shows the count and reads it out", async () => {
    await renderWithProviders(<Badge count={2} testID="badge" />);
    expect(screen.getByText("2")).toBeOnTheScreen();
    expect(screen.getByTestId("badge")).toHaveAccessibleName("2");
  });

  // "99+" is drawn for the eye; screen readers hear the words, so the drawn text is hidden from them.
  it("caps a large count at 99+ and says so in words", async () => {
    await renderWithProviders(<Badge count={128} testID="badge" />);
    expect(screen.queryByText("99+")).toBeNull();
    expect(screen.getByText("99+", { includeHiddenElements: true })).toBeOnTheScreen();
    expect(screen.getByTestId("badge")).toHaveAccessibleName("More than 99");
    // The web reads the words from visually hidden text (react-native-web ignores the label).
    expect(classes(screen.getByText("More than 99").props.className)).toEqual(
      expect.arrayContaining(["native:hidden", "web:sr-only"]),
    );
  });

  it("caps at a custom max", async () => {
    await renderWithProviders(<Badge count={1200} max={999} />);
    expect(screen.getByText("999+", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("renders nothing for an empty count", async () => {
    await renderWithProviders(
      <>
        <Badge count={0} testID="zero" />
        <Badge count={-3} testID="negative" />
        <Badge testID="missing" />
      </>,
    );
    for (const id of ["zero", "negative", "missing"]) expect(screen.queryByTestId(id)).toBeNull();
  });

  it("shows a word instead of the number, even with a zero count", async () => {
    await renderWithProviders(<Badge count={0} label="New" tone="highlight" />);
    expect(screen.getByText("New")).toBeOnTheScreen();
  });

  it("takes the caller's spoken label and classes", async () => {
    await renderWithProviders(
      <Badge count={4} accessibilityLabel="4 waiting" className="ml-2" testID="badge" />,
    );
    const badge = screen.getByTestId("badge");
    expect(badge).toHaveAccessibleName("4 waiting");
    expect(badge.props.className).toContain("ml-2");
  });

  it("draws gold with midnight numerals, or peacock for a highlight", async () => {
    await renderWithProviders(<Badge count={3} testID="badge" />);
    expect(screen.getByTestId("badge").props.className).toContain("bg-brand");
    const label = screen.getByText("3").props.className;
    for (const name of ["text-brand-ink", "font-sans-bold", "text-2xs", "tabular-nums"])
      expect(label).toContain(name);
    expect(badgeStyles({ tone: "highlight" })).toContain("bg-highlight");
    expect(badgeLabelStyles({ tone: "highlight" })).toContain("text-highlight-ink");
    for (const name of ["rounded-full", "min-h-5", "min-w-5", "px-1.5"])
      expect(badgeStyles()).toContain(name);
  });
});
