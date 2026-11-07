import { StyleSheet } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { Text } from "./text";
import { textStyles } from "./text.styles";

describe("Text", () => {
  it("renders its children", async () => {
    await renderWithProviders(<Text>Hotels</Text>);
    expect(screen.getByText("Hotels")).toBeOnTheScreen();
  });

  it("announces headings as headers and body as plain text", async () => {
    await renderWithProviders(
      <>
        <Text variant="heading">Section</Text>
        <Text>Body</Text>
      </>,
    );
    expect(screen.getByRole("header", { name: "Section" })).toBeOnTheScreen();
    expect(screen.queryByRole("header", { name: "Body" })).toBeNull();
  });

  it("maps variants, tones and weights to Peacock Night token classes", () => {
    expect(textStyles({ variant: "title" })).toContain("font-display");
    expect(textStyles({ variant: "eyebrow" })).toContain("tracking-eyebrow");
    expect(textStyles({ variant: "data" })).toContain("tabular-nums");
    expect(textStyles({ variant: "greeting" })).toContain("font-devanagari");
    // Needs-you is gold: Peacock Night has no red.
    expect(textStyles({ tone: "danger" })).toContain("text-brand");
    expect(textStyles({ weight: "semibold" })).toContain("font-sans-semibold");
    expect(textStyles({ weight: "semibold" })).not.toContain("font-sans ");
  });

  it("never bolds Gilda Display and gives body text its 80% strength", async () => {
    await renderWithProviders(
      <>
        <Text variant="title" weight="bold">
          Welcome back
        </Text>
        <Text>Paragraph</Text>
        <Text variant="eyebrow">Label</Text>
      </>,
    );
    expect(screen.getByText("Welcome back").props.className).not.toContain("font-sans-bold");
    expect(screen.getByText("Paragraph").props.className).toContain("text-body");
    expect(screen.getByText("Label").props.className).toContain("text-muted");
  });

  it("keeps tabular digits on native for data", async () => {
    await renderWithProviders(<Text variant="data">₹16,000–24,000</Text>);
    expect(JSON.stringify(screen.getByText("₹16,000–24,000").props.style)).toContain(
      "tabular-nums",
    );
  });

  // NativeWind drops the tabular-nums class on native; a caller asking for it gets fontVariant.
  it("keeps tabular digits on native wherever the class asks for them", async () => {
    await renderWithProviders(
      <>
        <Text variant="title" className="text-right tabular-nums">
          ₹50,000
        </Text>
        <Text variant="caption">200 hotels</Text>
        <Text className="web:tabular-nums">12</Text>
      </>,
    );
    expect(StyleSheet.flatten(screen.getByText("₹50,000").props.style)).toEqual({
      fontVariant: ["tabular-nums"],
    });
    expect(StyleSheet.flatten(screen.getByText("200 hotels").props.style)).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByText("12").props.style)).toBeUndefined();
  });
});
