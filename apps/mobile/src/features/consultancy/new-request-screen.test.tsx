import { uiCopy } from "@ampm/ui";

import { fireEvent, screen, waitFor } from "../../test/render";
import { renderWithApi } from "../../test/api";
import {
  ENQUIRY,
  ENQUIRY_ID,
  fail,
  fakeApi,
  HOTEL,
  HOTEL_ID,
  ok,
  type FakeCall,
  type FakeResponse,
} from "./consultancy.fixtures";
import { NewRequestScreen } from "./new-request-screen";

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn() };

jest.mock("expo-router", () => ({ useRouter: () => mockRouter }));

const CREATE = "POST /consultancy/enquiries";

function requestApi(answer: FakeResponse, calls: FakeCall[] = []) {
  return fakeApi({ [`GET /hotels/${HOTEL_ID}`]: ok(HOTEL), [CREATE]: answer }, calls);
}

async function renderForm(fetchImpl: typeof fetch): Promise<void> {
  await renderWithApi(<NewRequestScreen hotelId={HOTEL_ID} />, fetchImpl);
}

async function fillForm({ from = "2027-02-14", to = "2027-02-16", guests = "120" } = {}) {
  await fireEvent.changeText(screen.getByPlaceholderText("2027-02-14"), from);
  await fireEvent.changeText(screen.getByPlaceholderText("2027-02-16"), to);
  await fireEvent.changeText(screen.getByPlaceholderText("120"), guests);
}

const sendButton = () => screen.getByRole("button", { name: "Send request" });

/** Dismisses the toast a test raised, which clears its timer, so none outlives the test. */
async function dismissToast(): Promise<void> {
  await fireEvent.press(screen.getByRole("button", { name: uiCopy.dismiss }));
}

beforeEach(() => jest.clearAllMocks());

describe("NewRequestScreen", () => {
  it("names the hotel and keeps Send request disabled until the request is valid", async () => {
    await renderForm(requestApi(ok({ kind: "routed_to_sales" })));
    expect(await screen.findByText("The Lake Pavilion")).toBeOnTheScreen();
    expect(sendButton()).toBeDisabled();
    await fillForm();
    expect(sendButton()).toBeEnabled();
  });

  it("names the field in a gold inline error when a date is not real", async () => {
    await renderForm(requestApi(ok({ kind: "routed_to_sales" })));
    await fillForm({ from: "2027-02-30" });
    expect(screen.getByText("Enter check-in as a real date, YYYY-MM-DD.")).toBeOnTheScreen();
    expect(sendButton()).toBeDisabled();
    await fireEvent.changeText(screen.getByPlaceholderText("2027-02-14"), "2027-02-18");
    expect(screen.getByText("Check-out must be on or after check-in.")).toBeOnTheScreen();
  });

  it("sends the request with the flexible-dates choice and opens the new enquiry", async () => {
    const calls: FakeCall[] = [];
    await renderForm(requestApi(ok({ kind: "enquiry", enquiry: ENQUIRY }), calls));
    await fillForm();
    await fireEvent.press(screen.getByRole("checkbox", { name: "My dates are flexible" }));
    await fireEvent.press(sendButton());
    await waitFor(() =>
      expect(mockRouter.replace).toHaveBeenCalledWith(`/portal/requests/${ENQUIRY_ID}`),
    );
    expect(calls.find((call) => call.route === CREATE)?.body).toEqual({
      hotelId: HOTEL_ID,
      dateFrom: "2027-02-14",
      dateTo: "2027-02-16",
      datesFlexible: true,
      guestEstimate: 120,
      roomsRequired: null,
      functionsSummary: null,
      contactPreference: null,
      notesClient: null,
    });
  });

  it("routes a demo prospect's request to Sales: a toast, then back", async () => {
    await renderForm(requestApi(ok({ kind: "routed_to_sales" })));
    await fillForm();
    await fireEvent.press(sendButton());
    expect(await screen.findByText("We've passed your request to our team")).toBeOnTheScreen();
    expect(mockRouter.back).toHaveBeenCalled();
    await dismissToast();
  });

  it("keeps the form and says so when the request cannot reach the server", async () => {
    const api = requestApi(ok({ kind: "routed_to_sales" }));
    const offlineOnSend: typeof fetch = (input, init) =>
      init?.method === "POST" ? Promise.reject(new Error("no network")) : api(input, init);
    await renderForm(offlineOnSend);
    await fillForm();
    await fireEvent.press(sendButton());
    expect(
      await screen.findByText(
        "Your request has not been sent. Send it again once you are back online.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByPlaceholderText("2027-02-14")).toHaveDisplayValue("2027-02-14");
    expect(mockRouter.back).not.toHaveBeenCalled();
    await dismissToast();
  });

  it("shows the API's message when the request is refused", async () => {
    await renderForm(requestApi(fail(409, "conflict", "You already asked about this hotel.")));
    await fillForm();
    await fireEvent.press(sendButton());
    expect(await screen.findByText("You already asked about this hotel.")).toBeOnTheScreen();
    expect(screen.getByText("Could not send your request")).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    await dismissToast();
  });
});
