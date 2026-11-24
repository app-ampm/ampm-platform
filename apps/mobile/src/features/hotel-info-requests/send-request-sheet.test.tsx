import { useState } from "react";

import type * as UiModule from "@ampm/ui";
import { Button } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import {
  failure,
  HOTEL_ID,
  ISSUED_URL,
  linkIssuedFixture,
  ok,
  REQUEST_ID,
  renderWithApi,
  routedFetch,
  staffMeFixture,
  type FetchFn,
} from "./info-requests.test-utils";
import { SendRequestSheet } from "./send-request-sheet";

const mockCopy = jest.fn<Promise<boolean>, [string]>();
const mockShare = jest.fn<Promise<boolean>, [string]>();

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  copyText: (text: string) => mockCopy(text),
  shareText: (text: string) => mockShare(text),
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

type Roles = ReturnType<typeof staffMeFixture>["roles"];

interface Seen {
  created?: unknown;
  shared?: unknown;
}

const HOTEL = { id: HOTEL_ID, name: "The Lakeside Palace", status: "active" } as const;

function sheetFetch(
  seen: Seen,
  roles: Roles = ["HT"],
  create = () => ok(linkIssuedFixture()),
): FetchFn {
  return routedFetch({
    "/me": () => ok(staffMeFixture(roles)),
    "/hotels-admin/hotel-form-mode": () => ok({ mode: "test_only" }),
    "/hotels-admin/info-requests": (init) => {
      seen.created = JSON.parse(String(init?.body));
      return create();
    },
    [`/hotels-admin/info-requests/${REQUEST_ID}/share-record`]: (init) => {
      seen.shared = JSON.parse(String(init?.body));
      return ok(linkIssuedFixture().request);
    },
  });
}

/** The sheet as the hotel record opens it, with a way to open it again after Done. */
function Harness({
  hotel = HOTEL,
}: {
  readonly hotel?: typeof HOTEL | { id: string; name: string; status: "draft" };
}) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <Button onPress={() => setOpen(true)} testID="reopen">
        Send request
      </Button>
      <SendRequestSheet open={open} hotel={hotel} onClose={() => setOpen(false)} />
    </>
  );
}

beforeEach(() => {
  mockCopy.mockReset().mockResolvedValue(true);
  mockShare.mockReset().mockResolvedValue(true);
});

describe("SendRequestSheet", () => {
  it("says what the hotel form's mode makes of the email", async () => {
    await renderWithApi(<Harness />, sheetFetch({}));
    expect(await screen.findByText("The hotel form is in test mode")).toBeOnTheScreen();
    expect(screen.getByText(/this link is not emailed/)).toBeOnTheScreen();
  });

  it("asks for the recipient's email before emailing the link, and sends nothing", async () => {
    const seen: Seen = {};
    await renderWithApi(<Harness />, sheetFetch(seen));
    await fireEvent.press(await screen.findByTestId("request-email-it"));
    await fireEvent.press(screen.getByTestId("send-request-submit"));
    expect(
      await screen.findByText("Enter the recipient's email to email the link"),
    ).toBeOnTheScreen();
    expect(seen.created).toBeUndefined();
  });

  it("creates the request, shows the link once with its warning, and forgets it on close", async () => {
    const seen: Seen = {};
    const answer = () => ok(linkIssuedFixture({ email: "queued" }));
    await renderWithApi(<Harness />, sheetFetch(seen, ["HT"], answer));
    await fireEvent.changeText(await screen.findByTestId("request-recipient-name"), "Priya Sharma");
    await fireEvent.changeText(
      screen.getByTestId("request-recipient-email"),
      "sales@lakeside.example",
    );
    await fireEvent.press(screen.getByTestId("request-email-it"));
    await fireEvent.press(screen.getByTestId("request-kind-refresh"));
    await fireEvent.press(screen.getByTestId("send-request-submit"));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    expect(screen.getByText("Shown only now")).toBeOnTheScreen();
    expect(screen.getByText("Emailed to sales@lakeside.example.")).toBeOnTheScreen();
    expect(seen.created).toEqual({
      target: "existing",
      hotelId: HOTEL_ID,
      kind: "refresh",
      recipientName: "Priya Sharma",
      recipientEmail: "sales@lakeside.example",
      emailIt: true,
      isTest: false,
    });
    await fireEvent.press(screen.getByTestId("send-request-done"));
    await fireEvent.press(screen.getByTestId("reopen"));
    expect(await screen.findByTestId("send-request-submit")).toBeOnTheScreen();
    expect(screen.queryByText(ISSUED_URL)).toBeNull();
  });

  it("copies the link, then records how it went to the hotel, without the link", async () => {
    const seen: Seen = {};
    await renderWithApi(<Harness />, sheetFetch(seen));
    await fireEvent.press(await screen.findByTestId("send-request-submit"));
    await fireEvent.press(await screen.findByTestId("issued-link-copy"));
    expect(mockCopy).toHaveBeenCalledWith(ISSUED_URL);
    // In the sheet itself: a toast would sit under the sheet's modal on the web.
    expect(await screen.findByTestId("issued-link-copied")).toHaveTextContent("Link copied.");
    await fireEvent.press(await screen.findByTestId("issued-link-record-submit"));
    expect(await screen.findByText("Choose how it was shared")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("issued-link-record-channel-whatsapp"));
    await fireEvent.press(screen.getByTestId("issued-link-record-submit"));
    expect(await screen.findByText("Share recorded.")).toBeOnTheScreen();
    expect(seen.shared).toEqual({ channel: "whatsapp" });
  });

  it("says in the sheet when the browser refuses the copy, and still offers the record step", async () => {
    mockCopy.mockResolvedValueOnce(false);
    await renderWithApi(<Harness />, sheetFetch({}));
    await fireEvent.press(await screen.findByTestId("send-request-submit"));
    await fireEvent.press(await screen.findByTestId("issued-link-copy"));
    expect(await screen.findByTestId("issued-link-copy-failed")).toHaveTextContent(
      "Could not copy: select the link above and copy it.",
    );
    // A link copied by hand is shared all the same.
    expect(screen.getByTestId("issued-link-record")).toBeOnTheScreen();
  });

  it("offers the record step after the share sheet, and not after a cancelled share", async () => {
    await renderWithApi(<Harness />, sheetFetch({}));
    await fireEvent.press(await screen.findByTestId("send-request-submit"));
    mockShare.mockResolvedValueOnce(false);
    await fireEvent.press(await screen.findByTestId("issued-link-share"));
    await waitFor(() => expect(mockShare).toHaveBeenCalledWith(ISSUED_URL));
    expect(screen.queryByTestId("issued-link-record")).toBeNull();
    await fireEvent.press(screen.getByTestId("issued-link-share"));
    expect(await screen.findByTestId("issued-link-record")).toBeOnTheScreen();
  });

  it("keeps the sheet open while the create is under way, so the link the server issues is shown", async () => {
    let give = (_response: Response): void => undefined;
    const created = new Promise<Response>((resolve) => (give = resolve));
    const answers = sheetFetch({});
    const fetch: FetchFn = (input, init) =>
      init?.method === "POST" && String(input).endsWith("/hotels-admin/info-requests")
        ? created
        : answers(input, init);
    await renderWithApi(<Harness />, fetch);
    await fireEvent.press(await screen.findByTestId("send-request-submit"));
    await fireEvent.press(
      screen.getByTestId("send-request-scrim", { includeHiddenElements: true }),
    );
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    // Escape on the web and the back gesture on Android: the modal's close request.
    await fireEvent(screen.getByTestId("send-request"), "requestClose");
    expect(screen.getByTestId("send-request-submit")).toBeOnTheScreen();
    give(ok(linkIssuedFixture()));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
  });

  it("shows the API's message when the hotel already has a live request", async () => {
    const message = "This hotel already has a live request: HIR-2026-0001";
    const conflict = () =>
      new Response(JSON.stringify({ error: { code: "conflict", message } }), { status: 409 });
    await renderWithApi(<Harness />, sheetFetch({}, ["HT"], conflict));
    await fireEvent.press(await screen.findByTestId("send-request-submit"));
    expect(await screen.findByTestId("request-refusal")).toBeOnTheScreen();
    expect(screen.getAllByText(message).length).toBeGreaterThan(0);
    expect(screen.queryByText(ISSUED_URL)).toBeNull();
  });

  it("offers the test switch to the Super Admin alone, held for a hotel that is not a draft", async () => {
    await renderWithApi(<Harness />, sheetFetch({}, ["SA"]));
    expect(
      await screen.findByText("Only a draft hotel can have a test request."),
    ).toBeOnTheScreen();
    expect(screen.getByTestId("request-is-test")).toBeDisabled();
  });

  it("lets the Super Admin make a test request for a draft hotel", async () => {
    const seen: Seen = {};
    const draft = { id: HOTEL_ID, name: "The Lakeside Palace", status: "draft" as const };
    await renderWithApi(<Harness hotel={draft} />, sheetFetch(seen, ["SA"]));
    await fireEvent.press(await screen.findByTestId("request-is-test"));
    expect(screen.getByText(/This test request's link opens the form/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("send-request-submit"));
    await screen.findByText(ISSUED_URL);
    expect(seen.created).toMatchObject({ isTest: true });
  });

  it("offers the Hotel team no test switch", async () => {
    await renderWithApi(<Harness />, sheetFetch({}));
    await screen.findByText("The hotel form is in test mode");
    expect(screen.queryByTestId("request-is-test")).toBeNull();
  });

  it("says the mode could not be read, and still lets the request be made", async () => {
    const fetch = routedFetch({
      "/me": () => ok(staffMeFixture(["HT"])),
      "/hotels-admin/hotel-form-mode": () => failure("internal", 500),
    });
    await renderWithApi(<Harness />, fetch);
    expect(await screen.findByText("Could not read the hotel form's mode")).toBeOnTheScreen();
    expect(screen.getByTestId("send-request-submit")).toBeOnTheScreen();
  });
});
