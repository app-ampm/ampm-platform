import { contrastPairs } from "@ampm/tokens";

import { renderWithProviders, screen } from "../../test/render";
import { Stat } from "./stat";
import { statStyles, statValueSize } from "./stat.styles";

describe("Stat", () => {
  it("reads as one phrase, not as a heading", async () => {
    await renderWithProviders(
      <Stat label="Live weddings" value={18} caption="3 with functions this week" />,
    );
    expect(screen.getByLabelText("Live weddings: 18 3 with functions this week")).toBeOnTheScreen();
    expect(screen.queryByRole("header")).toBeNull();
    expect(screen.getByText("Live weddings")).toBeOnTheScreen();
    expect(screen.getByText("18")).toBeOnTheScreen();
    expect(screen.getByText("3 with functions this week")).toBeOnTheScreen();
  });

  it("drops the caption when there is none, and takes an explicit label", async () => {
    await renderWithProviders(
      <>
        <Stat label="Tasks due today" value="12" testID="tasks" />
        <Stat label="Days left" value={18} accessibilityLabel="18 days of discovery left" />
      </>,
    );
    expect(screen.getByLabelText("Tasks due today: 12")).toBeOnTheScreen();
    expect(screen.getByTestId("tasks").children).toHaveLength(2);
    expect(screen.getByLabelText("18 days of discovery left")).toBeOnTheScreen();
  });

  it("sets the number in Gilda Display, gold for countdowns", async () => {
    await renderWithProviders(
      <Stat label="Wedding" value={98} caption="days to go" tone="brand" size="lg" />,
    );
    const number = String(screen.getByText("98").props.className);
    expect(number).toContain("font-display");
    expect(number).toContain("text-brand");
    expect(number).toContain("text-6xl");
    expect(String(screen.getByText("Wedding").props.className)).toContain("tracking-eyebrow");
    expect(String(screen.getByText("days to go").props.className)).toContain("text-muted");
  });

  it("sizes the KPI number at 44 and peacock at display size only", async () => {
    await renderWithProviders(<Stat label="Ready" value="10 / 10" tone="highlight" />);
    const number = String(screen.getByText("10 / 10").props.className);
    expect(number).toContain(statValueSize.md);
    expect(number).not.toContain("text-6xl");
    expect(number).toContain("text-highlight");
  });

  it("turns the label and caption gold on gold glass", async () => {
    await renderWithProviders(
      <Stat
        label="Availability requests"
        value={7}
        caption="2 past response time"
        detailTone="brand"
      />,
    );
    expect(String(screen.getByText("Availability requests").props.className)).toContain(
      "text-brand",
    );
    expect(String(screen.getByText("2 past response time").props.className)).toContain(
      "text-brand",
    );
    expect(String(screen.getByText("7").props.className)).toContain("text-primary");
  });

  // Pearl 58% on peacock glass is 3.9:1 on its opaque fallback; only pearl 100% and 80% are approved
  // there (tokens contrastPairs), so a days-left meter on peacock takes the body tone.
  it("sets the label and caption in pearl 80% on peacock glass", async () => {
    await renderWithProviders(
      <Stat label="Hotel discovery" value={18} caption="days left" detailTone="body" />,
    );
    for (const text of ["Hotel discovery", "days left"]) {
      const names = String(screen.getByText(text).props.className).split(" ");
      expect(names).toContain("text-body");
      expect(names).not.toContain("text-muted");
    }
    expect(contrastPairs).toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "body", on: "highlight-soft" })]),
    );
    expect(contrastPairs).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ text: "muted", on: "highlight-soft" })]),
    );
  });

  it("centres the whole column", async () => {
    expect(statStyles({ align: "center" })).toContain("items-center");
    expect(statStyles({})).toContain("items-start");
    await renderWithProviders(
      <Stat label="Guests" value={251} align="center" caption="attending" />,
    );
    expect(String(screen.getByText("251").props.className)).toContain("text-center");
    expect(String(screen.getByText("attending").props.className)).toContain("text-center");
  });
});
