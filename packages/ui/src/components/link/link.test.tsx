import { createRef, type ComponentRef } from "react";
import { Linking, type Pressable } from "react-native";

import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { Link } from "./link";
import { linkLabelStyles, linkStyles } from "./link.styles";

interface RouterLinkProps {
  readonly children: React.ReactNode;
  readonly href: string;
  readonly asChild?: boolean;
  readonly onPress?: () => void;
}

// Records what Expo Router's Link receives; it runs its onPress before navigating (asChild).
const mockRouterLink = jest.fn(({ children }: RouterLinkProps) => children);
jest.mock("expo-router", () => ({
  Link: (props: RouterLinkProps) => mockRouterLink(props),
}));

const hasIcon = () => JSON.stringify(screen.toJSON()).includes("RNSVGSvgView");

describe("Link", () => {
  it("reads as a link and navigates inside the app", async () => {
    await renderWithProviders(<Link href="/hotels">All hotels</Link>);
    expect(screen.getByRole("link", { name: "All hotels" })).toBeOnTheScreen();
  });

  it("opens external URLs in the browser and marks them with an icon", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    await renderWithProviders(
      <Link href="https://example.com" external variant="standalone">
        Website
      </Link>,
    );
    await fireEvent.press(screen.getByRole("link", { name: "Website" }));
    expect(openURL).toHaveBeenCalledWith("https://example.com");
    expect(hasIcon()).toBe(true);
    openURL.mockRestore();
  });

  it("sets a standalone link in gold Manrope 700 on a 44px target, without adding an arrow", async () => {
    await renderWithProviders(
      <Link href="/sign-in" variant="standalone">
        Sign in →
      </Link>,
    );
    const label = screen.getByText("Sign in →");
    expect(label.props.className).toContain("text-brand");
    expect(label.props.className).toContain("font-sans-bold");
    expect(screen.getByRole("link", { name: "Sign in →" }).props.className).toContain(
      "min-h-touch",
    );
    expect(hasIcon()).toBe(false);
  });

  it("underlines inline links so colour is never the only cue", async () => {
    await renderWithProviders(<Link href="/privacy">privacy notice</Link>);
    const label = screen.getByText("privacy notice");
    expect(label.props.className).toContain("underline");
    expect(label.props.className).toContain("text-brand");
  });

  it("draws nav links in pearl 80% that turn gold on hover, with the focus halo", async () => {
    await renderWithProviders(
      <Link href="/how-it-works" variant="nav">
        How it works
      </Link>,
    );
    const label = screen.getByText("How it works").props.className;
    expect(label).toContain("text-body");
    expect(label).toContain("web:hover:text-brand");
    expect(label).toContain("web:group-hover:text-brand");
    expect(label).not.toContain("font-sans-bold");
    const box = screen.getByRole("link", { name: "How it works" }).props.className;
    for (const name of ["group", "min-h-touch", "web:focus-visible:shadow-halo"])
      expect(box).toContain(name);
  });

  it("lets a quieter tone through and still turns it gold on hover", () => {
    const muted = linkLabelStyles({ variant: "standalone", tone: "muted" });
    expect(muted).toContain("text-muted");
    expect(muted).toContain("web:hover:text-brand");
    expect(linkLabelStyles({ variant: "standalone" })).not.toContain("hover:text-brand");
  });

  it("keeps Gilda Display at its single weight", () => {
    const heading = linkLabelStyles({ variant: "standalone", textVariant: "heading" });
    expect(heading).toContain("font-display");
    expect(heading).not.toContain("font-sans-bold");
  });

  it("gives the website one recipe per element", () => {
    expect(linkStyles({ variant: "nav" })).toContain("flex");
    expect(linkStyles({ variant: "inline" })).not.toContain("min-h-touch");
  });

  it("hands the caller's onPress to Expo Router, which runs it before navigating", async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <Link href="/hotels" onPress={onPress}>
        All hotels
      </Link>,
    );
    expect(mockRouterLink).toHaveBeenLastCalledWith(
      expect.objectContaining({ href: "/hotels", asChild: true, onPress }),
    );
  });

  it("runs the caller's onPress, then opens an external URL", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(undefined);
    const onPress = jest.fn();
    await renderWithProviders(
      <Link href="https://example.com" external onPress={onPress}>
        Website
      </Link>,
    );
    await fireEvent.press(screen.getByRole("link", { name: "Website" }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress.mock.invocationCallOrder[0]).toBeLessThan(
      openURL.mock.invocationCallOrder[0] ?? 0,
    );
    openURL.mockRestore();
  });

  it("forwards the other Pressable props to the link itself", async () => {
    await renderWithProviders(
      <Link href="/hotels" accessibilityHint="Shows every hotel" nativeID="all-hotels">
        All hotels
      </Link>,
    );
    const link = screen.getByRole("link", { name: "All hotels" });
    expect(link).toHaveProp("accessibilityHint", "Shows every hotel");
    expect(link).toHaveProp("nativeID", "all-hotels");
  });

  // Navigation marks the page on screen in words as well as in gold (never colour alone).
  it("marks the current nav link: gold, selected, and the current page on the web", async () => {
    await renderWithProviders(
      <>
        <Link href="/hotels" variant="nav" current>
          Hotels
        </Link>
        <Link href="/leads" variant="nav">
          Leads
        </Link>
      </>,
    );
    const current = screen.getByRole("link", { name: "Hotels" });
    expect(current).toBeSelected();
    expect(current).toHaveProp("aria-current", "page");
    expect(classes(screen.getByText("Hotels").props.className)).toContain("text-brand");
    const other = screen.getByRole("link", { name: "Leads" });
    expect(other).not.toBeSelected();
    expect(other).not.toHaveProp("aria-current");
    expect(classes(screen.getByText("Leads").props.className)).toContain("text-body");
  });

  it("forwards its ref to the pressable", async () => {
    const ref = createRef<ComponentRef<typeof Pressable>>();
    await renderWithProviders(
      <Link ref={ref} href="/hotels">
        All hotels
      </Link>,
    );
    expect(ref.current).not.toBeNull();
  });
});
