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

  it("maps variants, tones and weights to token classes", async () => {
    expect(textStyles({ variant: "title" })).toContain("font-display-semibold");
    expect(textStyles({ tone: "danger" })).toContain("text-danger");
    expect(textStyles({ weight: "semibold" })).toContain("font-sans-semibold");
    expect(textStyles({ weight: "semibold" })).not.toContain("font-sans ");
  });
});
