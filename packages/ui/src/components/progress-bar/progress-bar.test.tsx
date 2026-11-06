import { renderWithProviders, screen } from "../../test/render";
import { ProgressBar, clampProgress } from "./progress-bar";
import {
  progressFillStyles,
  progressSegmentStyles,
  progressTrackStyles,
} from "./progress-bar.styles";

describe("ProgressBar", () => {
  it("reads as a progress bar with its label and percentage", async () => {
    await renderWithProviders(<ProgressBar value={0.8} label="Readiness, Sangeet" />);
    const bar = screen.getByRole("progressbar", { name: "Readiness, Sangeet" });
    expect(bar).toHaveAccessibilityValue({ min: 0, max: 100, now: 80 });
  });

  it("falls back to the default label", async () => {
    await renderWithProviders(<ProgressBar value={0.5} />);
    expect(screen.getByRole("progressbar", { name: "Progress" })).toBeOnTheScreen();
  });

  it("draws the fill as the value's percentage", async () => {
    await renderWithProviders(<ProgressBar value={0.42} testID="bar" />);
    expect(screen.getByTestId("bar-fill")).toHaveStyle({ width: "42%" });
  });

  it("clamps values outside 0..1 and treats non-numbers as empty", async () => {
    expect(clampProgress(1.6)).toBe(1);
    expect(clampProgress(-0.2)).toBe(0);
    expect(clampProgress(Number.NaN)).toBe(0);
    await renderWithProviders(<ProgressBar value={3} testID="bar" />);
    expect(screen.getByTestId("bar-fill")).toHaveStyle({ width: "100%" });
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ now: 100 });
  });

  it("fills the first round(value × steps) segments in segmented mode", async () => {
    await renderWithProviders(<ProgressBar value={3 / 7} steps={7} size="sm" testID="rsvp" />);
    const segments = Array.from({ length: 7 }, (_, index) =>
      screen.getByTestId(`rsvp-segment-${index}`),
    );
    const filled = segments.filter((segment) => segment.props.className.includes("bg-highlight"));
    expect(filled).toHaveLength(3);
    expect(segments[3]?.props.className).toContain("bg-primary/12");
    expect(screen.queryByTestId("rsvp-fill")).toBeNull();
  });

  it("speaks the step count in segmented mode", async () => {
    await renderWithProviders(<ProgressBar value={3 / 7} steps={7} label="RSVP" />);
    expect(screen.getByRole("progressbar", { name: "RSVP" })).toHaveAccessibilityValue({
      now: 43,
      text: "3 of 7",
    });
  });

  it("speaks the caller's value text instead of the percentage", async () => {
    await renderWithProviders(<ProgressBar value={0.25} valueText="Step 1 of 4" />);
    expect(screen.getByRole("progressbar")).toHaveAccessibilityValue({ text: "Step 1 of 4" });
  });

  it("maps size and tone to the token classes", () => {
    expect(progressTrackStyles({ size: "sm" })).toContain("h-1");
    expect(progressTrackStyles({ size: "md" })).toContain("h-1.5");
    expect(progressTrackStyles({ size: "lg" })).toContain("h-2");
    expect(progressTrackStyles({})).toContain("bg-primary/12");
    expect(progressTrackStyles({})).toContain("rounded-full");
    expect(progressFillStyles({ tone: "highlight" })).toContain("bg-highlight");
    expect(progressFillStyles({ tone: "brand" })).toContain("bg-brand");
    expect(progressSegmentStyles({ filled: true, tone: "brand" })).toContain("bg-brand");
    expect(progressSegmentStyles({ filled: false, tone: "brand" })).not.toContain("bg-brand");
  });

  it("passes the size and tone through to what it draws", async () => {
    await renderWithProviders(<ProgressBar value={0.5} size="lg" tone="brand" testID="bar" />);
    expect(screen.getByTestId("bar").props.className).toContain("h-2");
    expect(screen.getByTestId("bar-fill").props.className).toContain("bg-brand");
  });
});
