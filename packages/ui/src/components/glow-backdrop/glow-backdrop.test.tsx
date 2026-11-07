import { glow } from "@ampm/tokens";

import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { GlowBackdrop } from "./glow-backdrop";
import {
  ORB_RADIUS_RATIO,
  glowOpacityAt,
  glowOrbs,
  glowStops,
  orbCircles,
} from "./glow-backdrop.styles";

const layout = (width: number, height: number) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

interface HostNode {
  readonly type: string;
  readonly props: Record<string, unknown>;
  readonly children: readonly unknown[] | null;
}

function isHostNode(value: unknown): value is HostNode {
  return typeof value === "object" && value !== null && "type" in value && "props" in value;
}

/** Every host element of one type in the rendered tree (the SVG circles are not queryable by role). */
function hostNodes(type: string): HostNode[] {
  const found: HostNode[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) value.forEach(visit);
    else if (isHostNode(value)) {
      if (value.type === type) found.push(value);
      value.children?.forEach(visit);
    }
  };
  visit(screen.toJSON());
  return found;
}

const backdrop = () => screen.getByTestId("glow", { includeHiddenElements: true });

describe("GlowBackdrop", () => {
  it("is a layer screen readers and touches pass through", async () => {
    await renderWithProviders(<GlowBackdrop testID="glow" />);
    expect(screen.queryByTestId("glow")).toBeNull();
    expect(backdrop()).toHaveProp("pointerEvents", "none");
    expect(backdrop()).toHaveProp("accessibilityElementsHidden", true);
    expect(backdrop()).toHaveProp("importantForAccessibility", "no-hide-descendants");
    expect(backdrop().props.className).toContain("absolute inset-0 overflow-hidden");
  });

  it("draws its orbs once the container is measured, sized to it", async () => {
    const onLayout = jest.fn();
    await renderWithProviders(<GlowBackdrop testID="glow" onLayout={onLayout} />);
    expect(hostNodes("RNSVGCircle")).toHaveLength(0);
    await fireEvent(backdrop(), "layout", layout(390, 844));
    const circles = hostNodes("RNSVGCircle");
    expect(circles).toHaveLength(2);
    const scale = glowOrbs.corners[0]?.scale ?? 1;
    expect(circles[0]?.props.r).toBeCloseTo(scale * ORB_RADIUS_RATIO * 390);
    expect(onLayout).toHaveBeenCalledTimes(1);
  });

  it("places peacock top-left and gold bottom-right by default", () => {
    const [peacock, gold] = orbCircles("corners", 390, 844);
    expect(peacock).toMatchObject({ tone: "peacock" });
    expect(peacock?.cx).toBeLessThan(195);
    expect(peacock?.cy).toBeLessThan(422);
    expect(gold).toMatchObject({ tone: "gold" });
    expect(gold?.cx).toBeGreaterThan(195);
    expect(gold?.cy).toBeGreaterThan(422);
  });

  // §3: orbs go behind headings and whitespace, never under small muted text. ScreenHeader's eyebrow
  // (pearl 58% at 10px) is the first line in the gutter, 16 under the top inset, or 60 lower under a
  // back button; pearl 58% keeps 4.5:1 on 25% peacock glow or less.
  it.each([
    { device: "phone", width: 390, height: 844, inset: 47, gutter: 18 },
    { device: "phone with a tall notch", width: 393, height: 852, inset: 59, gutter: 18 },
    { device: "tablet", width: 768, height: 1024, inset: 24, gutter: 32 },
    { device: "desktop", width: 1440, height: 900, inset: 0, gutter: 48 },
  ])("keeps the default glow off the header's eyebrow on a $device", (frame) => {
    const { width, height, inset, gutter } = frame;
    for (const top of [inset + 16, inset + 16 + 60]) {
      for (const dx of [0, 40, 80, 120]) {
        for (const dy of [0, 7, 14]) {
          const point = { x: gutter + dx, y: top + dy };
          expect(glowOpacityAt("corners", width, height, point)).toBeLessThanOrEqual(0.25);
        }
      }
    }
    // The title under the eyebrow still starts in the glow.
    const title = { x: gutter, y: inset + 16 + 36 };
    expect(glowOpacityAt("corners", width, height, title)).toBeGreaterThan(0.1);
  });

  it("measures the glow from the orbs' gradients, layered", () => {
    const [peacock] = orbCircles("corners", 390, 844);
    if (!peacock) throw new Error("no peacock orb");
    const centre = { x: peacock.cx, y: peacock.cy };
    expect(glowOpacityAt("corners", 390, 844, centre)).toBeCloseTo(glow.peacock.opacity);
    const edge = { x: peacock.cx + glow.peacock.fadeAt * peacock.r, y: peacock.cy };
    expect(glowOpacityAt("corners", 390, 844, edge)).toBeCloseTo(0);
    expect(glowOpacityAt("none", 390, 844, centre)).toBe(0);
  });

  it("raises both orbs for heroes and centres peacock for confirmations", () => {
    for (const orb of orbCircles("top", 1440, 900)) expect(orb.cy).toBeLessThan(225);
    const [peacock, gold] = orbCircles("center", 1440, 900);
    expect(peacock?.cx).toBeCloseTo(720);
    expect(gold?.cy).toBeGreaterThan(800);
    expect(orbCircles("none", 1440, 900)).toEqual([]);
  });

  it("takes the gradient strengths from the tokens", () => {
    expect(glowStops("peacock")).toEqual([
      { offset: 0, opacity: glow.peacock.opacity },
      { offset: glow.peacock.fadeAt, opacity: 0 },
    ]);
    expect(glowStops("gold")[0]?.opacity).toBe(0.3);
    expect(glowStops("gold")[1]?.offset).toBe(0.66);
  });

  it("gives every backdrop its own gradient names", async () => {
    await renderWithProviders(
      <>
        <GlowBackdrop testID="first" />
        <GlowBackdrop testID="second" />
      </>,
    );
    for (const testID of ["first", "second"])
      await fireEvent(
        screen.getByTestId(testID, { includeHiddenElements: true }),
        "layout",
        layout(320, 640),
      );
    const names = hostNodes("RNSVGRadialGradient").map((node) => node.props.name);
    expect(names).toHaveLength(4);
    expect(new Set(names).size).toBe(4);
  });

  it("draws nothing for variant none", async () => {
    await renderWithProviders(<GlowBackdrop testID="glow" variant="none" />);
    expect(screen.queryByTestId("glow", { includeHiddenElements: true })).toBeNull();
  });
});
