import { failure, offlineFetch, ok, TEST_API_BASE, type FetchFn } from "../../test/api";
import { fireEvent, screen } from "../../test/render";
import { staffMeFixture } from "../accounts/accounts.test-utils";
import { HotelImportScreen } from "./hotel-import-screen";
import { dryRunResult, IMPORT_CSV } from "./hotel-import.test-utils";
import { renderWithApi, routedFetch } from "./hotels-admin.test-utils";

jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("./pick-csv-file", () => ({ pickCsvFile: jest.fn() }));

/*
 * TW-25's states around the form (code.md: every screen handles its error and offline states): the kinds
 * on offer come from `/me`, so a failed `/me` is an error to retry or a session to renew, never the role
 * denial; and while a preview or an import is under way the kind stays as it is, so the answer that
 * comes back is always the chosen kind's.
 */

/** A fetch whose preview answers only when the test lets it, so the screen stays mid-request. */
function heldPreview(): { readonly fetch: FetchFn; readonly answer: () => void } {
  const waiting: (() => void)[] = [];
  const fetch: FetchFn = (input) => {
    const path = String(input).replace(TEST_API_BASE, "");
    if (path === "/me") return Promise.resolve(ok(staffMeFixture(["HT"])));
    return new Promise<Response>((resolve) => waiting.push(() => resolve(ok(dryRunResult()))));
  };
  return { fetch, answer: () => waiting.forEach((resolve) => resolve()) };
}

describe("HotelImportScreen when /me fails", () => {
  it("offers sign-in, not the role denial, when the session has ended", async () => {
    await renderWithApi(
      <HotelImportScreen />,
      routedFetch({ "/me": () => failure("unauthenticated", 401) }),
    );
    expect(await screen.findByText("Sign in to import")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-import-none")).toBeNull();
  });

  it("says it is offline, with a retry, when the API cannot be reached", async () => {
    await renderWithApi(<HotelImportScreen />, offlineFetch);
    expect(await screen.findByText("You are offline")).toBeOnTheScreen();
    expect(screen.queryByTestId("hotel-import-none")).toBeNull();
  });
});

describe("HotelImportScreen while a request is under way", () => {
  it("keeps the kind until the preview answers, so its report is the chosen kind's", async () => {
    const held = heldPreview();
    await renderWithApi(<HotelImportScreen />, held.fetch);
    await fireEvent.changeText(await screen.findByTestId("hotel-import-content"), IMPORT_CSV);
    await fireEvent.press(screen.getByTestId("hotel-import-validate"));
    expect(screen.getByTestId("hotel-import-kind-rooms")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("hotel-import-kind-rooms"));
    expect(screen.getByText("Hotels CSV columns")).toBeOnTheScreen();
    held.answer();
    expect(await screen.findByText("2 hotels to add or update")).toBeOnTheScreen();
    expect(screen.getByTestId("hotel-import-kind-rooms")).toBeEnabled();
    expect(screen.getByText("Hotels CSV columns")).toBeOnTheScreen();
  });
});
