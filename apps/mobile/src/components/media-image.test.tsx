import { renderWithApi } from "../test/api";
import { screen } from "../test/render";
import { MediaImage } from "./media-image";

/** The sheet of tests never fetches media bytes; a 200 keeps the ApiProvider's fetch happy. */
const okFetch = (async () => new Response("{}", { status: 200 })) as typeof fetch;

describe("MediaImage", () => {
  it("resolves a signed /media/blob URL against the API base before loading it", async () => {
    await renderWithApi(
      <MediaImage uri="/media/blob?key=abc&sig=1" alt="Aravalli photo" />,
      okFetch,
    );
    const img = await screen.findByLabelText("Aravalli photo", { includeHiddenElements: true });
    // Resolved against TEST_API_BASE (http://api.test) — on the box this is …/_api/media/blob, which the
    // proxy serves, instead of /media/blob at the app origin (the bug that showed blank thumbnails).
    // expo-image normalises `source` to an array of sources.
    expect(img.props.source).toEqual([{ uri: "http://api.test/media/blob?key=abc&sig=1" }]);
  });

  it("passes an absolute URL (an S3/CDN link) through unchanged", async () => {
    await renderWithApi(
      <MediaImage uri="https://cdn.example.com/x.jpg" alt="CDN photo" />,
      okFetch,
    );
    const img = await screen.findByLabelText("CDN photo", { includeHiddenElements: true });
    expect(img.props.source).toEqual([{ uri: "https://cdn.example.com/x.jpg" }]);
  });
});
