import { backgroundImage, colors } from "@ampm/tokens";

import { classes, renderWithProviders, screen } from "../../test/render";
import { PhotoPlaceholder } from "./photo-placeholder";
import { photoPlaceholderStyles, photoStripes, STRIPE_BAND } from "./photo-placeholder.styles";

/** "#DDB861" as react-native-svg's processed colour: opaque alpha over the RGB. */
const argb = (hex: string) => (0xff000000 + Number.parseInt(hex.slice(1), 16)) >>> 0;

describe("PhotoPlaceholder", () => {
  it("is an image named by its label, with the label as a caption", async () => {
    await renderWithProviders(<PhotoPlaceholder label="Palace photo · Lake Pichola" />);
    expect(screen.getByRole("image", { name: "Palace photo · Lake Pichola" })).toBeOnTheScreen();
    const caption = screen.getByText("Palace photo · Lake Pichola");
    expect(caption.props.className).toContain("uppercase");
    expect(caption.props.className).toContain("text-muted");
  });

  it("hides the caption on a thumbnail but keeps the name", async () => {
    await renderWithProviders(<PhotoPlaceholder label="Raj Niwas Palace" showLabel={false} />);
    expect(screen.getByRole("image", { name: "Raj Niwas Palace" })).toBeOnTheScreen();
    expect(screen.queryByText("Raj Niwas Palace")).toBeNull();
  });

  it("falls back to a generic name when the label is empty", async () => {
    await renderWithProviders(<PhotoPlaceholder label="" />);
    expect(screen.getByRole("image", { name: "Photo" })).toBeOnTheScreen();
  });

  it("draws bands on nothing, a well only for midnight, and takes size and radius from the caller", async () => {
    expect(classes(photoPlaceholderStyles())).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^bg-/)]),
    );
    expect(classes(photoPlaceholderStyles({ tone: "peacock" }))).not.toEqual(
      expect.arrayContaining([expect.stringMatching(/^bg-/)]),
    );
    expect(classes(photoPlaceholderStyles({ tone: "midnight" }))).toContain("bg-primary/6");
    await renderWithProviders(
      <PhotoPlaceholder label="Hero" testID="photo" className="h-40 w-full rounded-2xl" />,
    );
    const frame = classes(screen.getByTestId("photo").props.className);
    expect(frame).toEqual(expect.arrayContaining(["overflow-hidden", "rounded-2xl"]));
    expect(frame).not.toContain("rounded-lg");
  });

  // The tokens' stripe recipe, the same the website draws with bg-stripes-*: 14 bands at 135°.
  it("draws the tokens' stripes: gold 14% or peacock 10% bands, 14 wide", async () => {
    expect(backgroundImage["stripes-gold"]).toContain("rgba(221, 184, 97, 0.14) 0 14px");
    expect(backgroundImage["stripes-peacock"]).toContain("rgba(19, 138, 133, 0.1) 0 14px");
    expect(STRIPE_BAND).toBe(14);
    await renderWithProviders(
      <>
        <PhotoPlaceholder label="Palace" testID="gold" />
        <PhotoPlaceholder label="Lake" tone="peacock" testID="peacock" />
      </>,
    );
    for (const tone of ["gold", "peacock"] as const) {
      const frame = screen.getByTestId(tone);
      const pattern = frame.queryAll((node) => node.type === "RNSVGPattern")[0];
      expect(pattern?.props.width).toBe(28);
      const band = frame.queryAll((node) => node.type === "RNSVGRect")[0];
      expect(band?.props.width).toBe(14);
      expect(band?.props.fillOpacity).toBe(photoStripes[tone].opacity);
      // react-native-svg hands the colour to native as opaque ARGB: the token's hex, not pearl.
      expect(band?.props.fill).toEqual({
        type: 0,
        payload: argb(colors[photoStripes[tone].color].light),
      });
    }
    expect(photoStripes.gold.opacity).toBe(0.14);
    expect(photoStripes.peacock.opacity).toBe(0.1);
  });
});
