import type { ReactNode } from "react";
import { Text } from "react-native";

import { uiCopy } from "@ampm/ui";

import { fireEvent, screen } from "../../test/render";
import { renderWithApi } from "../../test/api";
import {
  CLOSED_ENQUIRY,
  ENQUIRY,
  ENQUIRY_ID,
  fail,
  fakeApi,
  HOTEL,
  HOTEL_ID,
  ok,
  page,
} from "./consultancy.fixtures";
import { RequestsListScreen } from "./requests-list-screen";

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

async function renderList(fetchImpl: typeof fetch, tabBar?: ReactNode): Promise<void> {
  await renderWithApi(<RequestsListScreen tabBar={tabBar} />, fetchImpl);
}

beforeEach(() => jest.clearAllMocks());

describe("RequestsListScreen", () => {
  it("shows the loading panel while the enquiries are pending", async () => {
    await renderList(() => new Promise<Response>(() => {}));
    expect(screen.getByText("Enquiries")).toBeOnTheScreen();
    expect(screen.getByTestId("requests-loading")).toBeOnTheScreen();
  });

  it("lists each enquiry with its hotel, stay, party and a status chip", async () => {
    await renderList(
      fakeApi({
        "GET /consultancy/enquiries": ok(page([ENQUIRY, CLOSED_ENQUIRY])),
        [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
      }),
    );
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(screen.getByText("12–14 Feb 2027")).toBeOnTheScreen();
    expect(screen.getByText("300 guests")).toBeOnTheScreen();
    expect(screen.getByText("Your decision")).toBeOnTheScreen();
    // The second hotel is out of reach (404): the row keeps its generic title, and says how it closed.
    expect(screen.getByText("Hotel request")).toBeOnTheScreen();
    expect(screen.getByText("28 Feb – 2 Mar 2027")).toBeOnTheScreen();
    expect(screen.getByText("1 guest")).toBeOnTheScreen();
    expect(screen.getByText("Not available")).toBeOnTheScreen();
  });

  it("opens an enquiry when its row is pressed", async () => {
    await renderList(
      fakeApi({
        "GET /consultancy/enquiries": ok(page([ENQUIRY])),
        [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL),
      }),
    );
    const row = await screen.findByRole("button", {
      name: "The Lake Pavilion, Your decision, 12–14 Feb 2027, 300 guests",
    });
    await fireEvent.press(row);
    expect(mockRouter.push).toHaveBeenCalledWith(`/portal/requests/${ENQUIRY_ID}`);
  });

  it("offers to browse hotels when there are no requests yet", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": ok(page([])) }));
    expect(await screen.findByText("No hotel requests yet")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Browse hotels" }));
    expect(mockRouter.push).toHaveBeenCalledWith("/hotels");
  });

  it("shows the offline state on a network failure", async () => {
    await renderList(() => Promise.reject(new Error("no network")));
    expect(await screen.findByText(uiCopy.offline.title)).toBeOnTheScreen();
  });

  it("asks the person to sign in when the session is missing", async () => {
    await renderList(
      fakeApi({ "GET /consultancy/enquiries": fail(401, "unauthenticated", "Sign in") }),
    );
    expect(await screen.findByText("Sign in to view your requests")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Sign in" }));
    expect(mockRouter.replace).toHaveBeenCalledWith("/sign-in");
  });

  it("shows the retryable error state when the list fails", async () => {
    await renderList(fakeApi({ "GET /consultancy/enquiries": fail(500, "internal") }));
    expect(await screen.findByText(uiCopy.error.title)).toBeOnTheScreen();
  });

  it("draws the tab bar the route supplies, and goes back from its header", async () => {
    await renderList(() => new Promise<Response>(() => {}), <Text testID="tab-bar">Tabs</Text>);
    expect(screen.getByTestId("tab-bar")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Back" }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
