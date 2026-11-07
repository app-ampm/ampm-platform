import type { EntitlementModule, MeResponse } from "@ampm/core";
import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { HotelDetailScreen } from "./hotel-detail-screen";
import {
  clientMe,
  detailFixture,
  fail,
  fakeApi,
  HOTEL_ID,
  hotelFixture,
  ok,
  pageOf,
  renderWithApi,
  savedFixture,
} from "./hotels.test-utils";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn(), push: mockPush }),
}));

const SAVED_ID = "018f0000-0000-7000-8000-0000000000a1";

interface Account {
  readonly me: MeResponse;
  /** Whether this hotel is already on the shortlist. */
  readonly saved: boolean;
  /** Fails the save and the removal, as the server would on a write it refuses. */
  readonly refuseWrites?: boolean;
}

function accountApi({ me, saved, refuseWrites = false }: Account) {
  const shortlist = saved ? [savedFixture(hotelFixture(), SAVED_ID)] : [];
  return fakeApi((method, url) => {
    if (url.pathname === `/hotels/${HOTEL_ID}/save`) {
      if (refuseWrites) return fail("internal", 500);
      return method === "POST"
        ? ok(savedFixture(hotelFixture(), SAVED_ID))
        : ok({ hotelId: HOTEL_ID });
    }
    if (url.pathname === `/hotels/${HOTEL_ID}`) return ok(detailFixture());
    if (url.pathname === "/hotels/saved") return ok(pageOf(shortlist));
    if (url.pathname === "/me") return ok(me);
    return undefined;
  });
}

async function renderFor(account: Account) {
  const api = accountApi(account);
  await renderWithApi(<HotelDetailScreen hotelId={HOTEL_ID} />, api.fetch);
  await screen.findByText("The Lake Pavilion");
  return api;
}

const SAVER: readonly EntitlementModule[] = ["hotel_discovery", "saved_hotels"];
/** A subscriber: the shortlist and hotel assistance, so the footer asks for availability. */
const SUBSCRIBER: readonly EntitlementModule[] = [...SAVER, "hotel_assistance"];

/** The account's modules, the listed ones read-only (a downgrade keeps them readable first). */
function withReadOnly(modules: readonly EntitlementModule[], readOnly: EntitlementModule[]) {
  const me = clientMe(modules);
  return { ...me, entitlements: { ...me.entitlements, readOnlyModules: readOnly } };
}

beforeEach(() => mockPush.mockClear());

describe("HotelDetailScreen actions", () => {
  it("saves the hotel from the footer's one gold button when the account may not ask", async () => {
    const api = await renderFor({ me: clientMe(SAVER), saved: false });
    const save = await screen.findByRole("button", { name: "Save hotel" });
    expect(String(save.props.className)).toContain("bg-brand");
    expect(screen.queryByRole("button", { name: "Check availability" })).toBeNull();
    await fireEvent.press(save);
    await waitFor(() => expect(api.calls).toContain(`POST /hotels/${HOTEL_ID}/save`));
  });

  it("shows a saved hotel in peacock and removes it on a second press", async () => {
    const api = await renderFor({ me: clientMe(SAVER), saved: true });
    const saved = await screen.findByRole("button", { name: "Saved to shortlist" });
    expect(String(saved.props.className)).toContain("bg-highlight");
    await fireEvent.press(saved);
    await waitFor(() => expect(api.calls).toContain(`DELETE /hotels/${HOTEL_ID}/save`));
  });

  it("says so when the shortlist cannot be updated", async () => {
    await renderFor({ me: clientMe(SAVER), saved: false, refuseWrites: true });
    await fireEvent.press(await screen.findByRole("button", { name: "Save hotel" }));
    expect(await screen.findByText("Could not update your shortlist")).toBeOnTheScreen();
    // Dismissing also clears the toast's timer, which would otherwise outlive the test.
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.dismiss }));
    expect(screen.queryByText("Could not update your shortlist")).toBeNull();
  });

  it("hides the save for an account whose shortlist is read-only", async () => {
    await renderFor({ me: withReadOnly(SUBSCRIBER, ["saved_hotels"]), saved: false });
    // The availability check proves /me has loaded; only the shortlist write is withheld.
    await screen.findByRole("button", { name: "Check availability" });
    expect(screen.queryByRole("button", { name: "Save hotel" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Saved to shortlist" })).toBeNull();
  });

  it("asks for availability from the footer's one gold button when the account may ask", async () => {
    await renderFor({ me: clientMe(["hotel_discovery", "hotel_assistance"]), saved: false });
    const check = await screen.findByRole("button", { name: "Check availability" });
    expect(String(check.props.className)).toContain("bg-brand");
    await fireEvent.press(check);
    expect(mockPush).toHaveBeenCalledWith(`/portal/requests/new?hotelId=${HOTEL_ID}`);
  });

  it("moves the save to a glass heart over the photo when the footer asks for availability", async () => {
    const api = await renderFor({ me: clientMe(SUBSCRIBER), saved: false });
    await screen.findByRole("button", { name: "Check availability" });
    const heart = await screen.findByRole("button", { name: "Save hotel" });
    expect(String(heart.props.className)).not.toContain("bg-brand");
    await fireEvent.press(heart);
    await waitFor(() => expect(api.calls).toContain(`POST /hotels/${HOTEL_ID}/save`));
  });

  it("turns the heart peacock once the hotel is saved", async () => {
    await renderFor({ me: clientMe(SUBSCRIBER), saved: true });
    const heart = await screen.findByRole("button", { name: "Saved to shortlist" });
    expect(String(heart.props.className)).toContain("bg-highlight");
    expect(screen.getAllByRole("button", { name: "Check availability" })).toHaveLength(1);
  });

  it("offers no availability check without the entitlement, or with it read-only", async () => {
    await renderFor({ me: withReadOnly(SUBSCRIBER, ["hotel_assistance"]), saved: false });
    // The footer keeps the save, which proves /me has loaded.
    await screen.findByRole("button", { name: "Save hotel" });
    expect(screen.queryByRole("button", { name: "Check availability" })).toBeNull();
  });
});
