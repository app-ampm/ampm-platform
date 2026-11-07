import { colors } from "@ampm/tokens";

import { classes, renderWithProviders, screen } from "../../test/render";
import { StatusChip } from "./status-chip";
import { chipDotStyles, chipStyles, chipTextStyles, type StatusTone } from "./status-chip.styles";

/** The six treatments of docs/design/peacock-night.md §8: fill or stroke, then the label's ink. */
const TREATMENTS: readonly (readonly [StatusTone, readonly string[], string])[] = [
  ["success", ["bg-success"], "text-highlight-ink"],
  ["info", ["border-primary/40", "bg-transparent"], "text-primary"],
  ["warning", ["bg-brand/16"], "text-brand"],
  ["danger", ["bg-brand"], "text-brand-ink"],
  ["neutral", ["bg-primary/8"], "text-primary/62"],
  ["brand", ["bg-highlight/30", "border-highlight/70"], "text-primary"],
];

describe("StatusChip", () => {
  it("always carries its label, read as one text element", async () => {
    await renderWithProviders(<StatusChip label="Verified" tone="success" icon="check" />);
    const chip = screen.getByLabelText("Verified");
    expect(chip).toHaveProp("accessible", true);
    expect(chip).toHaveProp("accessibilityRole", "text");
    expect(screen.getByText("Verified")).toBeOnTheScreen();
  });

  it("lets the spoken label differ from the visible one", async () => {
    await renderWithProviders(
      <StatusChip label="2 blocked" tone="danger" accessibilityLabel="2 tasks blocked" />,
    );
    expect(screen.getByLabelText("2 tasks blocked")).toBeOnTheScreen();
  });

  it.each(TREATMENTS)("draws %s with its fill and ink", async (tone, fill, ink) => {
    await renderWithProviders(<StatusChip label="Status" tone={tone} testID="chip" />);
    const pill = classes(screen.getByTestId("chip").props.className);
    for (const token of fill) {
      expect(classes(chipStyles({ tone }))).toContain(token);
      expect(pill).toContain(token);
    }
    expect(classes(chipTextStyles({ tone }))).toContain(ink);
    expect(classes(screen.getByText("Status").props.className)).toContain(ink);
  });

  it("is a Manrope 700 pill whose recipe also works as plain DOM classes", () => {
    const chip = classes(chipStyles({}));
    expect(chip).toContain("rounded-full");
    // The website's DOM elements are display:block until a recipe says flex.
    expect(chip).toContain("flex");
    expect(classes(chipTextStyles({}))).toEqual(
      expect.arrayContaining(["font-sans-bold", "text-xs"]),
    );
  });

  it("tightens the padding at the small size", () => {
    expect(classes(chipStyles({ size: "sm" }))).toEqual(expect.arrayContaining(["px-2.5", "py-1"]));
    expect(classes(chipStyles({ size: "md" }))).toEqual(expect.arrayContaining(["px-3", "py-1.5"]));
  });

  it("draws the leading dot in the label's colour only when asked", async () => {
    await renderWithProviders(<StatusChip label="Synced" tone="success" testID="plain" />);
    expect(screen.queryByTestId("plain-dot")).toBeNull();
    await renderWithProviders(
      <StatusChip label="Verified 2 Nov" tone="success" dot testID="dot" />,
    );
    expect(classes(screen.getByTestId("dot-dot").props.className)).toContain("bg-highlight-ink");
    expect(classes(chipDotStyles({ tone: "warning" }))).toContain("bg-brand");
    expect(classes(chipDotStyles({ tone: "neutral" }))).toContain("bg-primary/62");
  });

  it("colours the icon like the label", async () => {
    await renderWithProviders(
      <StatusChip label="Needs approval" tone="danger" icon="alert-circle" />,
    );
    expect(JSON.stringify(screen.toJSON())).toContain(`"stroke":"${colors["brand-ink"].light}"`);
  });

  it("passes className and view props to the pill", async () => {
    await renderWithProviders(
      <StatusChip label="Demo" tone="brand" className="self-stretch" testID="chip" nativeID="x" />,
    );
    const chip = screen.getByTestId("chip");
    expect(classes(chip.props.className)).toContain("self-stretch");
    expect(classes(chip.props.className)).not.toContain("self-start");
    expect(chip).toHaveProp("nativeID", "x");
  });
});
