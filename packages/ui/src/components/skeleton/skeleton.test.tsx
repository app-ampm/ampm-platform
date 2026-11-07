import { AccessibilityInfo } from "react-native";

import { classes, renderWithProviders, screen, waitFor } from "../../test/render";
import { Skeleton } from "./skeleton";
import { shimmerStyles, skeletonStyles } from "./skeleton.styles";

const HIDDEN = { includeHiddenElements: true };

describe("Skeleton", () => {
  afterEach(() => jest.restoreAllMocks());

  it("is hidden from assistive technology", async () => {
    await renderWithProviders(<Skeleton testID="skeleton" className="h-4 w-24" />);
    expect(screen.queryByTestId("skeleton")).toBeNull();
    expect(screen.getByTestId("skeleton", HIDDEN)).toHaveProp("accessibilityElementsHidden", true);
  });

  it("draws pearl 6% at radius 16 by default, sized only by the caller", async () => {
    await renderWithProviders(<Skeleton testID="skeleton" className="h-28 w-full" />);
    const block = classes(screen.getByTestId("skeleton", HIDDEN).props.className);
    expect(block).toEqual(expect.arrayContaining(["bg-primary/6", "rounded", "h-28", "w-full"]));
  });

  it("maps the shapes to their radii", () => {
    expect(classes(skeletonStyles({ shape: "rect" }))).toContain("rounded");
    expect(classes(skeletonStyles({ shape: "circle" }))).toContain("rounded-full");
    expect(classes(skeletonStyles({ shape: "text" }))).toEqual(
      expect.arrayContaining(["h-4", "rounded-full"]),
    );
  });

  it("shimmers in pearl over the base without taking layout space", async () => {
    await renderWithProviders(<Skeleton testID="skeleton" className="h-4 w-24" />);
    const shimmer = screen.getByTestId("skeleton-shimmer", HIDDEN);
    expect(classes(shimmer.props.className)).toEqual(
      expect.arrayContaining(["absolute", "inset-0", "bg-primary/5"]),
    );
    expect(classes(shimmerStyles)).toContain("bg-primary/5");
  });

  it("stands still under reduced motion", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    await renderWithProviders(<Skeleton testID="skeleton" className="h-4 w-24" />);
    await waitFor(() => expect(screen.queryByTestId("skeleton-shimmer", HIDDEN)).toBeNull());
    expect(screen.getByTestId("skeleton", HIDDEN)).toBeTruthy();
  });
});
