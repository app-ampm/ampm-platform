import type { StaffRole } from "@ampm/policy";
import type { DestinationListItemView } from "@ampm/core";

import { act, fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { DestinationsScreen } from "./destinations-screen";
import {
  DESTINATION_ID,
  destinationListItemFixture,
  destinationViewFixture,
  failure,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, replace: mockReplace }),
  useCanGoBack: () => mockCanGoBack,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

const LIST = "/hotels-admin/destinations";
const ONE = `${LIST}/${DESTINATION_ID}`;

interface Sent {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

interface FetchOptions {
  readonly roles?: readonly StaffRole[];
  readonly sent?: Sent[];
  /** What a create answers: the new destination, or a refusal. */
  readonly onCreate?: () => Response;
}

/** The screen's API: `/me` for the role, the list, and the writes, each recorded. */
function destinationsFetch(
  items: readonly DestinationListItemView[],
  { roles = ["HT"], sent = [], onCreate }: FetchOptions = {},
): FetchFn {
  const record = (path: string, init: RequestInit | undefined): void => {
    sent.push({ method: init?.method ?? "GET", path, body: JSON.parse(String(init?.body)) });
  };
  return routedFetch({
    "/me": () => ok(staffMeFixture([...roles])),
    [LIST]: (init) => {
      if (init?.method !== "POST") return ok({ items });
      record(LIST, init);
      return onCreate ? onCreate() : ok(destinationViewFixture());
    },
    [ONE]: (init) => {
      record(ONE, init);
      return ok(destinationViewFixture({ status: "inactive" }));
    },
  });
}

/** Let `/me` answer, so the role's actions have settled before asserting their absence. */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));

beforeEach(() => {
  mockBack.mockClear();
  mockReplace.mockClear();
  mockCanGoBack = true;
});

describe("DestinationsScreen: the list", () => {
  it("lists each destination with its web address, place, status, hotels and website flag", async () => {
    await renderWithApi(
      <DestinationsScreen />,
      destinationsFetch([destinationListItemFixture({ region: "Mewar", hotelCount: 12 })]),
    );
    expect(
      await screen.findByLabelText("Udaipur, Mewar, Rajasthan, India, active, 12 hotels"),
    ).toBeOnTheScreen();
    expect(screen.getByText("udaipur")).toBeOnTheScreen();
    expect(screen.getByText("Mewar, Rajasthan, India")).toBeOnTheScreen();
    expect(screen.getByText("Active")).toBeOnTheScreen();
    expect(screen.getByText("12")).toBeOnTheScreen();
    expect(screen.getByText("Yes")).toBeOnTheScreen();
  });

  it("shows the error with a retry when the list fails to load", async () => {
    await renderWithApi(
      <DestinationsScreen />,
      routedFetch({ [LIST]: () => failure("internal", 500) }),
    );
    expect(await screen.findByText("Try again")).toBeOnTheScreen();
  });

  it("goes back to where the person came from", async () => {
    await renderWithApi(<DestinationsScreen />, destinationsFetch([destinationListItemFixture()]));
    await fireEvent.press(await screen.findByLabelText("Back to the hotel catalogue"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("goes to the hotel catalogue when opened straight from a link", async () => {
    mockCanGoBack = false;
    await renderWithApi(<DestinationsScreen />, destinationsFetch([destinationListItemFixture()]));
    await fireEvent.press(await screen.findByLabelText("Back to the hotel catalogue"));
    expect(mockReplace).toHaveBeenCalledWith("/hotels-admin");
    expect(mockBack).not.toHaveBeenCalled();
  });
});

describe("DestinationsScreen: the Hotel team adds and edits", () => {
  it("adds the first destination: a draft in India, with no web address when none is typed", async () => {
    const sent: Sent[] = [];
    await renderWithApi(<DestinationsScreen />, destinationsFetch([], { sent }));
    expect(await screen.findByText("No destinations yet")).toBeOnTheScreen();
    await fireEvent.press(await screen.findByText("Add a destination"));
    await fireEvent.changeText(await screen.findByTestId("destination-name"), "Udaipur");
    await fireEvent.changeText(screen.getByTestId("destination-state"), "Rajasthan");
    await fireEvent.press(screen.getByTestId("destination-edit-submit"));
    expect(await screen.findByText("Destination added")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "POST",
        path: LIST,
        body: {
          name: "Udaipur",
          region: null,
          state: "Rajasthan",
          country: "India",
          description: null,
          status: "draft",
          publicVisible: false,
        },
      },
    ]);
  });

  it("edits a destination from its row, never sending the web address", async () => {
    const sent: Sent[] = [];
    await renderWithApi(
      <DestinationsScreen />,
      destinationsFetch([destinationListItemFixture()], { sent }),
    );
    await fireEvent.press(await screen.findByLabelText(/^Udaipur, Rajasthan, India/));
    expect(await screen.findByTestId("destination-slug-fixed")).toHaveTextContent("udaipur");
    expect(screen.queryByTestId("destination-slug")).toBeNull();
    await fireEvent.press(screen.getByTestId("destination-status-inactive"));
    await fireEvent.press(screen.getByTestId("destination-edit-submit"));
    expect(await screen.findByText("Destination updated")).toBeOnTheScreen();
    expect(sent).toEqual([
      {
        method: "PATCH",
        path: ONE,
        body: {
          name: "Udaipur",
          region: null,
          state: "Rajasthan",
          country: "India",
          description: null,
          status: "inactive",
          publicVisible: true,
        },
      },
    ]);
  });

  it("checks the name and a typed web address before sending anything", async () => {
    const sent: Sent[] = [];
    await renderWithApi(<DestinationsScreen />, destinationsFetch([], { sent }));
    await fireEvent.press(await screen.findByTestId("destination-new"));
    await fireEvent.changeText(await screen.findByTestId("destination-slug"), "North Goa");
    await fireEvent.press(screen.getByTestId("destination-edit-submit"));
    expect(await screen.findByText("Enter the destination's name")).toBeOnTheScreen();
    expect(
      screen.getByText("Use lowercase letters, numbers and single hyphens, e.g. north-goa"),
    ).toBeOnTheScreen();
    expect(sent).toEqual([]);
  });

  it("shows the server's refusal when the web address is already in use", async () => {
    await renderWithApi(
      <DestinationsScreen />,
      destinationsFetch([], { onCreate: () => failure("conflict", 409) }),
    );
    await fireEvent.press(await screen.findByTestId("destination-new"));
    await fireEvent.changeText(await screen.findByTestId("destination-name"), "Udaipur");
    await fireEvent.press(screen.getByTestId("destination-edit-submit"));
    // The envelope's message, which the API words as the slug clash; the form stays open to change it.
    expect(await screen.findByText("conflict")).toBeOnTheScreen();
    expect(screen.getByTestId("destination-edit-submit")).toBeOnTheScreen();
  });
});

describe("DestinationsScreen: a role that only reads", () => {
  it("shows a Sales Manager the destinations with no way to add or edit one", async () => {
    await renderWithApi(
      <DestinationsScreen />,
      destinationsFetch([destinationListItemFixture()], { roles: ["SM"] }),
    );
    expect(await screen.findByText("Udaipur")).toBeOnTheScreen();
    await settle();
    expect(screen.queryByTestId("destination-new")).toBeNull();
    await fireEvent.press(screen.getByText("Udaipur"));
    expect(screen.queryByTestId("destination-edit-submit")).toBeNull();
  });

  it("offers no first destination to a Sales Manager when there is none", async () => {
    await renderWithApi(<DestinationsScreen />, destinationsFetch([], { roles: ["SM"] }));
    expect(await screen.findByText("No destinations yet")).toBeOnTheScreen();
    await settle();
    expect(screen.queryByText("Add a destination")).toBeNull();
  });
});
