import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { Image } from "./image";

const source = { uri: "https://example.com/pavilion.jpg" };

describe("Image", () => {
  it("describes the picture to screen readers", async () => {
    await renderWithProviders(
      <Image source={source} alt="Lakeside pavilion" className="h-20 w-20" testID="photo" />,
    );
    expect(screen.getByLabelText("Lakeside pavilion")).toBeOnTheScreen();
    expect(screen.getByTestId("photo-skeleton", { includeHiddenElements: true })).toBeOnTheScreen();
  });

  it("hides a decorative image", async () => {
    await renderWithProviders(
      <Image source={source} alt="" className="h-20 w-20" testID="photo" />,
    );
    expect(screen.queryByLabelText("Lakeside pavilion")).toBeNull();
  });

  it("loads on a pearl 6% skeleton and drops it once the picture is in", async () => {
    const onLoad = jest.fn();
    await renderWithProviders(
      <Image source={source} alt="Lakeside pavilion" testID="photo" onLoad={onLoad} />,
    );
    const skeleton = screen.getByTestId("photo-skeleton", { includeHiddenElements: true });
    expect(skeleton.props.className).toContain("bg-primary/6");
    await fireEvent(screen.getByLabelText("Lakeside pavilion"), "load", {
      nativeEvent: { cacheType: "none", source: { url: source.uri, width: 640, height: 400 } },
    });
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("photo-skeleton", { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId("photo").props.className).not.toContain("bg-primary/6");
  });

  it("keeps the frame on the pearl 6% surface when the picture cannot load", async () => {
    const onError = jest.fn();
    const onLoadEnd = jest.fn();
    await renderWithProviders(
      <Image
        source={source}
        alt="Lakeside pavilion"
        radius="lg"
        testID="photo"
        onError={onError}
        onLoadEnd={onLoadEnd}
      />,
    );
    await fireEvent(screen.getByLabelText("Lakeside pavilion"), "error", {
      nativeEvent: { error: "404" },
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onLoadEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("photo-skeleton", { includeHiddenElements: true })).toBeNull();
    const frame = screen.getByTestId("photo");
    expect(frame.props.className).toContain("bg-primary/6");
    expect(frame.props.className).toContain("rounded-lg");
  });
});
