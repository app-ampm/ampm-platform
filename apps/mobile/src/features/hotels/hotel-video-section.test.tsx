import { screen } from "../../test/render";
import { HotelSectionBody } from "./hotel-sections";
import { detailFixture, fakeApi, renderWithApi } from "./hotels.test-utils";

// expo-video drives a native module; stub it (VideoView returned directly as a View — no JSX in the
// factory for NativeWind to rewrite) so the section renders the player wrapper, not the real player. This
// file is separate from hotel-detail-sections.test.tsx so cssInterop(View) here never touches that suite.
jest.mock("expo-video", () => ({
  useVideoPlayer: jest.fn(() => ({})),
  VideoView: jest.requireActual("react-native").View,
}));

describe("HotelSectionBody — video (B17)", () => {
  it("plays each of the hotel's videos, each named for screen readers", async () => {
    const videos = [
      {
        id: "018f0000-0000-7000-8000-0000000000e1",
        caption: "A walkthrough of the lawn",
        url: "/media/blob?key=v1",
      },
      { id: "018f0000-0000-7000-8000-0000000000e2", caption: null, url: "/media/blob?key=v2" },
    ];
    await renderWithApi(
      <HotelSectionBody hotel={detailFixture({ videos })} section="video" />,
      fakeApi(() => undefined).fetch,
    );
    // The caption is shown as visible text, so it survives the web export (where the player drops aria-label).
    expect(screen.getByText("A walkthrough of the lawn")).toBeOnTheScreen();
    // A caption-less video still gets a generic accessible name on the player itself.
    expect(screen.getByLabelText("Hotel video")).toBeOnTheScreen();
  });
});
