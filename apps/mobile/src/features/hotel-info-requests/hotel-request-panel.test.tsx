import { hotelInfoRequestHistoryQueryKey } from "@ampm/api-client";
import type { HotelInfoRequestDetail, HotelInfoRequestSummaryView } from "@ampm/core";
import type * as UiModule from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { HotelRequestPanel } from "./hotel-request-panel";
import {
  HOTEL_ID,
  ISSUED_URL,
  linkIssuedFixture,
  ok,
  REQUEST_ID,
  renderWithApi,
  requestFullFixture,
  requestSummaryFixture,
  routedFetch,
  staffMeFixture,
  failure,
  type FetchFn,
} from "./info-requests.test-utils";

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  copyText: () => Promise.resolve(true),
  shareText: null,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

type Roles = ReturnType<typeof staffMeFixture>["roles"];

interface Seen {
  reissued?: unknown;
  revoked?: unknown;
  patched?: unknown;
  shared?: unknown;
}

const HOTEL = { id: HOTEL_ID, name: "The Lakeside Palace", status: "active" } as const;
const REQUEST = `/hotels-admin/info-requests/${REQUEST_ID}`;

interface Setup {
  readonly roles?: Roles;
  readonly customCapabilities?: string[];
  readonly history?: readonly HotelInfoRequestSummaryView[];
  readonly detail?: HotelInfoRequestDetail;
}

function panelFetch(seen: Seen, setup: Setup = {}): FetchFn {
  const detail = setup.detail ?? requestFullFixture();
  return routedFetch({
    "/me": () => ok(staffMeFixture(setup.roles ?? ["HT"], setup.customCapabilities)),
    "/hotels-admin/hotel-form-mode": () => ok({ mode: "on" }),
    [`/hotels-admin/hotels/${HOTEL_ID}/info-requests`]: () =>
      ok({ items: setup.history ?? [requestSummaryFixture()], nextCursor: null }),
    [REQUEST]: (init) => {
      if (init?.method === "PATCH") seen.patched = JSON.parse(String(init.body));
      return ok(detail);
    },
    [`${REQUEST}/reissue`]: (init) => {
      seen.reissued = JSON.parse(String(init?.body));
      return ok(linkIssuedFixture({ request: requestFullFixture({ tokenGeneration: 2 }) }));
    },
    [`${REQUEST}/revoke`]: (init) => {
      seen.revoked = JSON.parse(String(init?.body));
      return ok(requestFullFixture({ status: "revoked" }));
    },
    [`${REQUEST}/share-record`]: (init) => {
      seen.shared = JSON.parse(String(init?.body));
      return ok(detail);
    },
  });
}

async function renderPanel(seen: Seen, setup: Setup = {}): Promise<void> {
  await renderWithApi(
    <HotelRequestPanel hotelId={HOTEL_ID} hotel={HOTEL} />,
    panelFetch(seen, setup),
  );
}

describe("HotelRequestPanel", () => {
  it("shows the Hotel team the live request in full, with every action it takes", async () => {
    await renderPanel({});
    expect(
      await screen.findByText("Synthetic Sales Desk · sales@lakeside.example"),
    ).toBeOnTheScreen();
    expect(screen.getByText("HIR-2026-0001")).toBeOnTheScreen();
    expect(screen.getByText("Open")).toBeOnTheScreen();
    expect(screen.getByText("Link valid until 24 Dec 2026")).toBeOnTheScreen();
    expect(screen.getByText("Issued 24 Nov 2026 (link 1), not emailed")).toBeOnTheScreen();
    expect(screen.getByText(/^Request created · 24 NOV 2026/)).toBeOnTheScreen();
    for (const action of ["reissue", "extend", "share", "edit", "revoke"]) {
      expect(screen.getByTestId(`request-${action}`)).toBeOnTheScreen();
    }
    expect(screen.queryByTestId("request-send")).toBeNull();
  });

  it("shows a Sales Manager the summary: no recipient, no events, no action", async () => {
    await renderPanel({}, { roles: ["SM"], detail: requestSummaryFixture() });
    expect(await screen.findByText("HIR-2026-0001")).toBeOnTheScreen();
    await waitFor(() => expect(screen.getByText("Link valid until 24 Dec 2026")).toBeOnTheScreen());
    expect(screen.queryByText(/sales@lakeside.example/)).toBeNull();
    expect(screen.queryByTestId("request-events")).toBeNull();
    expect(screen.queryByTestId("request-actions")).toBeNull();
    expect(screen.queryByTestId("request-send")).toBeNull();
  });

  it("D-164: hides the actions from a custom role without the update key, whatever it is sent", async () => {
    await renderPanel(
      {},
      {
        roles: [],
        customCapabilities: ["hotels.info_requests.read:all"],
        detail: requestFullFixture(),
      },
    );
    expect(
      await screen.findByText("Synthetic Sales Desk · sales@lakeside.example"),
    ).toBeOnTheScreen();
    expect(screen.queryByTestId("request-actions")).toBeNull();
  });

  it("shows nothing to a role that may not read requests", async () => {
    await renderPanel({}, { roles: ["FA"] });
    await waitFor(() => expect(screen.queryByTestId("request-panel")).toBeNull());
  });

  it("offers Send request when the hotel has no live request, and opens its sheet", async () => {
    await renderPanel({}, { history: [] });
    expect(await screen.findByText(/No information request yet/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("request-send"));
    expect(await screen.findByTestId("send-request-submit")).toBeOnTheScreen();
  });

  it("offers a Project Manager no Send request, which needs the create key", async () => {
    await renderPanel({}, { roles: ["PM"], history: [] });
    expect(await screen.findByText(/No information request yet/)).toBeOnTheScreen();
    expect(screen.queryByTestId("request-send")).toBeNull();
  });

  it("warns that every copy stops working, then shows the new link once", async () => {
    const seen: Seen = {};
    await renderPanel(seen);
    await fireEvent.press(await screen.findByTestId("request-reissue"));
    expect(
      await screen.findByText(/the ones the hotel forwarded to colleagues too/),
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("reissue-submit"));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    expect(screen.getByText("Shown only now")).toBeOnTheScreen();
    expect(seen.reissued).toEqual({ emailIt: false });
  });

  it("asks for a reason before it revokes, and revokes with it", async () => {
    const seen: Seen = {};
    await renderPanel(seen);
    await fireEvent.press(await screen.findByTestId("request-revoke"));
    await fireEvent.press(await screen.findByTestId("revoke-request-confirm"));
    expect(await screen.findByText("Say why the request is revoked")).toBeOnTheScreen();
    expect(seen.revoked).toBeUndefined();
    await fireEvent.changeText(
      screen.getByTestId("revoke-request-reason"),
      "Sent to the wrong hotel",
    );
    await fireEvent.press(screen.getByTestId("revoke-request-confirm"));
    expect(await screen.findByText("HIR-2026-0001 revoked")).toBeOnTheScreen();
    expect(seen.revoked).toEqual({ reason: "Sent to the wrong hotel" });
  });

  it("names how far a link can run, refuses more, and extends by the days typed", async () => {
    const seen: Seen = {};
    const far = {
      expiresAt: "2099-01-24T10:00:00.000Z",
      extendableUntil: "2099-02-10T10:00:00.000Z",
    };
    await renderPanel(seen, { detail: requestFullFixture(far) });
    await fireEvent.press(await screen.findByTestId("request-extend"));
    expect(
      await screen.findByText("Up to 10 Feb 2099, the latest this link can run."),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("extend-days"), "30");
    expect(
      screen.getByText("This link can be extended to 10 Feb 2099 at the latest"),
    ).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("extend-days"), "7");
    expect(screen.getByText("New expiry: 31 Jan 2099")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("extend-submit"));
    await waitFor(() => expect(seen.patched).toEqual({ extendDays: 7 }));
  });

  it("edits only what changed", async () => {
    const seen: Seen = {};
    await renderPanel(seen);
    await fireEvent.press(await screen.findByTestId("request-edit"));
    await fireEvent.changeText(
      await screen.findByTestId("edit-request-label"),
      "Lake refresh 2027",
    );
    await fireEvent.press(screen.getByTestId("edit-request-submit"));
    expect(await screen.findByText("Request updated")).toBeOnTheScreen();
    expect(seen.patched).toEqual({ displayLabel: "Lake refresh 2027" });
  });

  it("records a share from the panel, without the link", async () => {
    const seen: Seen = {};
    await renderPanel(seen);
    await fireEvent.press(await screen.findByTestId("request-share"));
    await fireEvent.press(await screen.findByTestId("record-share-form-channel-copy"));
    await fireEvent.press(screen.getByTestId("record-share-form-submit"));
    expect(await screen.findByText("Share recorded")).toBeOnTheScreen();
    expect(seen.shared).toEqual({ channel: "copy" });
  });

  it("offers an expired link Extend but not Reissue, and a submitted request no Revoke", async () => {
    const expired = requestFullFixture({
      isExpired: true,
      expiresAt: "2026-11-01T10:00:00.000Z",
      extendableUntil: "2099-01-01T10:00:00.000Z",
    });
    await renderPanel({}, { detail: expired });
    expect(await screen.findByText("Link expired on 1 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByTestId("request-extend")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-reissue")).toBeNull();
  });

  it("offers a submitted request no Revoke", async () => {
    await renderPanel({}, { detail: requestFullFixture({ status: "submitted" }) });
    expect(await screen.findByTestId("request-reissue")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-revoke")).toBeNull();
  });

  it("keeps a link just reissued when the hotel's requests then fail to refresh", async () => {
    const reads = { history: 0 };
    const fetch = routedFetch({
      "/me": () => ok(staffMeFixture(["HT"])),
      "/hotels-admin/hotel-form-mode": () => ok({ mode: "on" }),
      [`/hotels-admin/hotels/${HOTEL_ID}/info-requests`]: () => {
        reads.history += 1;
        return reads.history === 1
          ? ok({ items: [requestSummaryFixture()], nextCursor: null })
          : failure("internal", 500);
      },
      [REQUEST]: () => ok(requestFullFixture()),
      [`${REQUEST}/reissue`]: () =>
        ok(linkIssuedFixture({ request: requestFullFixture({ tokenGeneration: 2 }) })),
    });
    const client = await renderWithApi(
      <HotelRequestPanel hotelId={HOTEL_ID} hotel={HOTEL} />,
      fetch,
    );
    await fireEvent.press(await screen.findByTestId("request-reissue"));
    await fireEvent.press(screen.getByTestId("reissue-submit"));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    const history = hotelInfoRequestHistoryQueryKey(HOTEL_ID);
    await waitFor(() => expect(client.getQueryState(history)?.status).toBe("error"));
    expect(screen.getByText(ISSUED_URL)).toBeOnTheScreen();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("says when the hotel's requests cannot load", async () => {
    const fetch = routedFetch({
      "/me": () => ok(staffMeFixture(["HT"])),
      [`/hotels-admin/hotels/${HOTEL_ID}/info-requests`]: () => failure("internal", 500),
    });
    await renderWithApi(<HotelRequestPanel hotelId={HOTEL_ID} hotel={HOTEL} />, fetch);
    expect(await screen.findByText("Something went wrong")).toBeOnTheScreen();
  });
});
