import { hotelInfoRequestQueryKey } from "@ampm/api-client";
import type * as UiModule from "@ampm/ui";

import { act, fireEvent, screen, waitFor } from "../../test/render";
import {
  failure,
  ISSUED_URL,
  linkIssuedFixture,
  ok,
  REQUEST_ID,
  renderWithApi,
  requestFullFixture,
  routedFetch,
} from "./info-requests.test-utils";
import { RequestDetailSheet } from "./request-detail-sheet";

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  copyText: () => Promise.resolve(true),
  shareText: null,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

/*
 * One request on a sheet, from TW-99 (D-188 §7): once the request has loaded, a refetch that fails (a
 * window focus, or the invalidation that follows a reissue) keeps the card, its open sheets and a link
 * just shown; the error shows only when there is no request to show.
 */

const REQUEST = `/hotels-admin/info-requests/${REQUEST_ID}`;

/** A fetch whose request read succeeds the first time and fails every time after. */
function failingAfterFirstRead() {
  const reads = { count: 0 };
  const fetch = routedFetch({
    "/hotels-admin/hotel-form-mode": () => ok({ mode: "on" }),
    [REQUEST]: () => {
      reads.count += 1;
      return reads.count === 1 ? ok(requestFullFixture()) : failure("internal", 500);
    },
    [`${REQUEST}/reissue`]: () =>
      ok(linkIssuedFixture({ request: requestFullFixture({ tokenGeneration: 2 }) })),
  });
  return { fetch, reads };
}

const sheet = (
  <RequestDetailSheet
    requestId={REQUEST_ID}
    reference="HIR-2026-0001"
    canUpdate
    onClose={() => undefined}
  />
);

describe("RequestDetailSheet", () => {
  it("keeps the request on screen when a background refetch fails", async () => {
    const { fetch, reads } = failingAfterFirstRead();
    const client = await renderWithApi(sheet, fetch);
    expect(await screen.findByTestId("request-actions")).toBeOnTheScreen();
    await act(async () => {
      await client.invalidateQueries({ queryKey: hotelInfoRequestQueryKey(REQUEST_ID) });
    });
    await waitFor(() =>
      expect(client.getQueryState(hotelInfoRequestQueryKey(REQUEST_ID))?.status).toBe("error"),
    );
    expect(reads.count).toBe(2);
    expect(screen.getByTestId("request-actions")).toBeOnTheScreen();
    expect(screen.queryByText("Something went wrong")).toBeNull();
  });

  it("keeps a link just reissued when the refetch that follows the reissue fails", async () => {
    const { fetch, reads } = failingAfterFirstRead();
    const client = await renderWithApi(sheet, fetch);
    await fireEvent.press(await screen.findByTestId("request-reissue"));
    await fireEvent.press(await screen.findByTestId("reissue-submit"));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    await waitFor(() =>
      expect(client.getQueryState(hotelInfoRequestQueryKey(REQUEST_ID))?.status).toBe("error"),
    );
    expect(reads.count).toBeGreaterThan(1);
    expect(screen.getByText(ISSUED_URL)).toBeOnTheScreen();
    expect(screen.getByText("Shown only now")).toBeOnTheScreen();
  });

  it("says why the request did not load when there is none to show", async () => {
    const fetch = routedFetch({ [REQUEST]: () => failure("internal", 500) });
    await renderWithApi(sheet, fetch);
    expect(await screen.findByText("Something went wrong")).toBeOnTheScreen();
    expect(screen.queryByTestId("request-actions")).toBeNull();
  });
});
