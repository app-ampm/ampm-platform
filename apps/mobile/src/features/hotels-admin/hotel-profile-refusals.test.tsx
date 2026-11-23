import type { ErrorDetail, MeResponse } from "@ampm/core";

import { jsonResponse } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import {
  destinationListItemFixture,
  HOTEL_ID,
  hotelCuisineOptionsFixture,
  hotelStaffViewFixture,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

/** The fields the editor moved focus to, in order. */
const mockFocused: string[] = [];
jest.mock("./use-field-focus", () => ({
  useFieldFocus: () => ({
    fieldRef: () => () => undefined,
    focusField: (key: string) => {
      mockFocused.push(key);
    },
  }),
}));

const noop = (): void => {};
// Worded apart from the editor's own PIN check, so a pass proves the server's refusal reached the field.
const PIN_REFUSED = "Synthetic server refusal: this PIN does not fit the destination";
const CUISINE_REFUSED = "Choose a cuisine from the list, or Other";
const NOTES_REFUSED = "Too big: expected string to have <=10000 characters";

interface RefusingFetchOptions {
  /** The person whose grants decide the internal fields (D-171); no `/me` route when absent. */
  readonly me?: MeResponse | undefined;
  /** The destination list never answers, as while it is still loading. */
  readonly destinationsLoading?: boolean | undefined;
}

/** The editor's routes, the hotel's update refused as invalid with these details. */
function refusingFetch(
  details: readonly ErrorDetail[],
  { me, destinationsLoading = false }: RefusingFetchOptions = {},
): FetchFn {
  const routes = routedFetch({
    ...(me ? { "/me": () => ok(me) } : {}),
    "/hotels-admin/destinations": () => ok({ items: [destinationListItemFixture()] }),
    "/hotels-admin/cuisine-options": () => ok(hotelCuisineOptionsFixture()),
    [`/hotels-admin/hotels/${HOTEL_ID}`]: () =>
      jsonResponse(
        { error: { code: "validation_failed", message: "Validation failed", details } },
        400,
      ),
  });
  return (input, init) =>
    destinationsLoading && String(input).includes("/hotels-admin/destinations")
      ? new Promise<Response>(() => {})
      : routes(input, init);
}

async function save(): Promise<void> {
  await fireEvent.press(screen.getByTestId("hotel-profile-submit"));
}

describe("HotelProfileEditSheet: a save the server refuses", () => {
  beforeEach(() => {
    mockFocused.length = 0;
  });

  it("puts a PIN refused while the destination list was loading under its field, and focuses it", async () => {
    await renderWithApi(
      <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
      refusingFetch([{ path: "postalCode", message: PIN_REFUSED }], { destinationsLoading: true }),
    );
    await fireEvent.changeText(await screen.findByTestId("hotel-postal-code"), "013001");
    await save();
    // The toast is announced and names the field; the error itself sits under the field.
    expect(await screen.findByText(`PIN code: ${PIN_REFUSED}`)).toBeOnTheScreen();
    expect(screen.getByText("Check the highlighted fields")).toBeOnTheScreen();
    expect(screen.getByText(PIN_REFUSED)).toBeOnTheScreen();
    expect(mockFocused).toEqual(["postalCode"]);
  });

  it("puts a cuisine dropped from the options under the chips, until the choice changes", async () => {
    await renderWithApi(
      <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
      refusingFetch([{ path: "cuisines.0", message: CUISINE_REFUSED }]),
    );
    await fireEvent.press(await screen.findByTestId("hotel-cuisine-asian"));
    await save();
    expect(await screen.findByText(`Cuisines: ${CUISINE_REFUSED}`)).toBeOnTheScreen();
    expect(screen.getByText(CUISINE_REFUSED)).toBeOnTheScreen();
    expect(mockFocused).toEqual(["cuisines"]);
    await fireEvent.press(screen.getByTestId("hotel-cuisine-asian"));
    expect(screen.queryByText(CUISINE_REFUSED)).toBeNull();
  });

  it("puts internal notes over 10,000 characters under their field, and focuses it", async () => {
    await renderWithApi(
      <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
      refusingFetch([{ path: "internalNotes", message: NOTES_REFUSED }], {
        me: staffMeFixture(["HT"]),
      }),
    );
    const notes = await screen.findByTestId("hotel-internal-notes");
    await fireEvent.changeText(notes, "x".repeat(10_001));
    await save();
    expect(await screen.findByText(`Internal notes: ${NOTES_REFUSED}`)).toBeOnTheScreen();
    expect(screen.getByText(NOTES_REFUSED)).toBeOnTheScreen();
    expect(mockFocused).toEqual(["internalNotes"]);
  });

  it("keeps the plain toast for a refusal naming no field the editor has, marking none", async () => {
    await renderWithApi(
      <HotelProfileEditSheet open hotel={hotelStaffViewFixture()} onClose={noop} />,
      refusingFetch([{ path: "streetViewRef", message: "Synthetic refusal" }]),
    );
    await screen.findByTestId("hotel-rooms");
    await save();
    expect(await screen.findByText("Validation failed")).toBeOnTheScreen();
    expect(screen.queryByText("Check the highlighted fields")).toBeNull();
    expect(screen.queryByText("Synthetic refusal")).toBeNull();
    expect(mockFocused).toEqual([]);
  });
});
