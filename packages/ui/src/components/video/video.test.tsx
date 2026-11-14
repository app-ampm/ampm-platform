import { renderWithProviders, screen } from "../../test/render";
import { Video } from "./video";

// expo-video drives a native module; stub it so the test exercises the wrapper (frame, label, radius),
// not the player itself. VideoView IS the RN View (returned directly — no JSX/createElement in the factory,
// which the NativeWind transform would rewrite to an out-of-scope runtime ref), so its props — the
// accessibility label among them — land on a host element the query can find.
jest.mock("expo-video", () => ({
  useVideoPlayer: jest.fn(() => ({})),
  VideoView: jest.requireActual("react-native").View,
}));

describe("Video", () => {
  it("names the video for screen readers inside its frame", async () => {
    await renderWithProviders(
      <Video
        source="https://media.test/lawn.mp4"
        label="A walkthrough of the lawn"
        radius="lg"
        testID="hotel-video"
      />,
    );
    expect(screen.getByLabelText("A walkthrough of the lawn")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-video")).toBeOnTheScreen();
  });
});
