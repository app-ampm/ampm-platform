import type { MediaAssetView } from "@ampm/core";

import { fireEvent, screen } from "../../test/render";
import { HotelMediaScreen } from "./hotel-media-screen";
import { pickMediaFile } from "./pick-media-file";
import {
  destinationViewFixture,
  failure,
  HOTEL_ID,
  hotelStaffDetailViewFixture,
  mediaAssetFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

jest.mock("./pick-media-file", () => ({ pickMediaFile: jest.fn() }));

const CLEAN_ID = "018f0000-0000-7000-8000-0000000c0a01";
const NEW_ID = "018f0000-0000-7000-8000-0000000c0a02";

interface Captured {
  registered?: unknown;
  uploaded?: boolean;
  patched?: unknown;
  deletedId?: string;
}

function mediaFetch(
  captured: Captured,
  items: MediaAssetView[] = [mediaAssetFixture({ id: CLEAN_ID })],
): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () => ok(hotelStaffDetailViewFixture()),
    "/hotels-admin/destinations": () => ok({ items: [destinationViewFixture()] }),
    "/media": (init) => {
      if (init?.method === "POST") {
        captured.registered = JSON.parse(String(init.body));
        return ok(mediaAssetFixture({ id: NEW_ID, scanStatus: "pending", caption: null }));
      }
      return ok({ items, nextCursor: null });
    },
    [`/media/${NEW_ID}/upload`]: () => {
      captured.uploaded = true;
      return ok(mediaAssetFixture({ id: NEW_ID, scanStatus: "clean", caption: null }));
    },
    [`/media/${CLEAN_ID}`]: (init) => {
      if (init?.method === "DELETE") {
        captured.deletedId = CLEAN_ID;
        return ok({ id: CLEAN_ID });
      }
      captured.patched = JSON.parse(String(init?.body));
      return ok(mediaAssetFixture({ id: CLEAN_ID, ...(captured.patched as object) }));
    },
    [`/media/${CLEAN_ID}/download-url`]: () =>
      ok({ url: "https://signed.test/thumb.jpg", expiresAt: "2026-11-09T00:00:00Z" }),
    [`/media/${NEW_ID}/download-url`]: () =>
      ok({ url: "https://signed.test/new.jpg", expiresAt: "2026-11-09T00:00:00Z" }),
  });
}

async function renderManager(captured: Captured, items?: MediaAssetView[]): Promise<void> {
  await renderWithApi(
    <HotelMediaScreen hotelId={HOTEL_ID} />,
    items ? mediaFetch(captured, items) : mediaFetch(captured),
  );
}

beforeEach(() => {
  jest.mocked(pickMediaFile).mockReset();
});

describe("HotelMediaScreen", () => {
  it("lists a hotel's photos with their scan, visibility and rights state", async () => {
    await renderManager({});
    expect(await screen.findByText("Lobby at dusk")).toBeOnTheScreen();
    expect(screen.getByText("Ready")).toBeOnTheScreen();
    expect(screen.getByText("Internal only")).toBeOnTheScreen();
    expect(screen.getByText("Consent needed")).toBeOnTheScreen();
  });

  it("opens the profile editor from the hotel's screen", async () => {
    await renderManager({});
    await fireEvent.press(await screen.findByTestId("hotel-edit-profile"));
    expect(await screen.findByDisplayValue("The Lakeside Palace")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-profile-submit")).toBeOnTheScreen();
  });

  it("adds a photo: picks a file, registers it and uploads the bytes", async () => {
    const captured: Captured = {};
    jest.mocked(pickMediaFile).mockResolvedValue({
      file: new Blob(["x"], { type: "image/jpeg" }),
      mimeType: "image/jpeg",
      sizeBytes: 3,
      name: "x.jpg",
    });
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId("media-add"));
    expect(await screen.findByText("Photo added")).toBeOnTheScreen();
    expect(captured.registered).toEqual({
      ownerType: "hotel",
      ownerId: HOTEL_ID,
      kind: "image",
      mimeType: "image/jpeg",
      sizeBytes: 3,
    });
    expect(captured.uploaded).toBe(true);
  });

  it("adds a video: registers it as a video (kind from the file) and uploads the bytes", async () => {
    const captured: Captured = {};
    jest.mocked(pickMediaFile).mockResolvedValue({
      file: new Blob(["x"], { type: "video/mp4" }),
      mimeType: "video/mp4",
      sizeBytes: 3,
      name: "clip.mp4",
    });
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId("media-add"));
    expect(await screen.findByText("Video added")).toBeOnTheScreen();
    expect(captured.registered).toEqual({
      ownerType: "hotel",
      ownerId: HOTEL_ID,
      kind: "video",
      mimeType: "video/mp4",
      sizeBytes: 3,
    });
    expect(captured.uploaded).toBe(true);
  });

  it("shows a video asset with a video name, a11y label and no broken thumbnail", async () => {
    await renderManager({}, [
      mediaAssetFixture({ kind: "video", mimeType: "video/mp4", caption: null }),
    ]);
    expect(await screen.findByText("Untitled video")).toBeOnTheScreen();
    expect(screen.getByLabelText("Video")).toBeOnTheScreen();
  });

  it("refuses a file over the size limit before uploading", async () => {
    const captured: Captured = {};
    jest.mocked(pickMediaFile).mockResolvedValue({
      file: new Blob(["x"], { type: "video/mp4" }),
      mimeType: "video/mp4",
      sizeBytes: 26 * 1024 * 1024,
      name: "big.mp4",
    });
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId("media-add"));
    expect(await screen.findByText(/over the 25 MB limit/)).toBeOnTheScreen();
    expect(captured.registered).toBeUndefined();
  });

  it("treats a blank-type file with a video extension as a video", async () => {
    const captured: Captured = {};
    jest.mocked(pickMediaFile).mockResolvedValue({
      file: new Blob(["x"], { type: "" }),
      mimeType: "application/octet-stream",
      sizeBytes: 3,
      name: "walkthrough.mp4",
    });
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId("media-add"));
    expect(await screen.findByText("Video added")).toBeOnTheScreen();
    expect((captured.registered as { kind?: string }).kind).toBe("video");
  });

  it("tells the user to use the web workspace when nothing can be picked", async () => {
    const captured: Captured = {};
    jest.mocked(pickMediaFile).mockResolvedValue(null);
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId("media-add"));
    expect(await screen.findByText("Add media from the web workspace")).toBeOnTheScreen();
    expect(captured.registered).toBeUndefined();
  });

  it("edits a photo's caption, visibility and rights", async () => {
    const captured: Captured = {};
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId(`media-edit-${CLEAN_ID}`));
    expect(await screen.findByText("Edit photo")).toBeOnTheScreen();
    // Wait for the form to seed from the photo before changing it.
    await screen.findByDisplayValue("Lobby at dusk");
    await fireEvent.press(screen.getByTestId("media-visibility-client"));
    await fireEvent.press(screen.getByTestId("media-rights-owned"));
    await fireEvent.press(screen.getByTestId("media-edit-submit"));
    expect(await screen.findByText("Photo updated")).toBeOnTheScreen();
    expect(captured.patched).toEqual({
      caption: "Lobby at dusk",
      visibility: "client",
      rightsStatus: "owned",
    });
  });

  it("warns that rights must be cleared before a client-facing photo is shown (GP-20)", async () => {
    await renderManager({});
    await fireEvent.press(await screen.findByTestId(`media-edit-${CLEAN_ID}`));
    await screen.findByDisplayValue("Lobby at dusk");
    // The photo's rights are still "consent needed"; making it client-facing must prompt for rights.
    await fireEvent.press(screen.getByTestId("media-visibility-client"));
    expect(await screen.findByTestId("media-rights-hint")).toBeOnTheScreen();
  });

  it("removes a photo after confirming", async () => {
    const captured: Captured = {};
    await renderManager(captured);
    await fireEvent.press(await screen.findByTestId(`media-delete-${CLEAN_ID}`));
    expect(await screen.findByText(/Remove Lobby at dusk/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("media-remove-confirm"));
    expect(await screen.findByText("Lobby at dusk removed")).toBeOnTheScreen();
    expect(captured.deletedId).toBe(CLEAN_ID);
  });

  it("says when there is no media yet", async () => {
    await renderManager({}, []);
    expect(await screen.findByText("No media yet")).toBeOnTheScreen();
  });

  it("asks to sign in once the session has ended", async () => {
    await renderWithApi(
      <HotelMediaScreen hotelId={HOTEL_ID} />,
      routedFetch({ "/media": () => failure("unauthenticated", 401) }),
    );
    expect(await screen.findByText("Sign in to manage media")).toBeOnTheScreen();
  });
});
