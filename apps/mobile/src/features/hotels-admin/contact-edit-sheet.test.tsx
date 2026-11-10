import { fireEvent, screen } from "../../test/render";
import { ContactEditSheet } from "./contact-edit-sheet";
import {
  CONTACT_ID,
  hotelContactViewFixture,
  HOTEL_ID,
  ok,
  renderWithApi,
  routedFetch,
  type FetchFn,
} from "./hotels-admin.test-utils";

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

interface Captured {
  created?: unknown;
  updated?: unknown;
}

function contactFetch(captured: Captured): FetchFn {
  return routedFetch({
    [`/hotels-admin/hotels/${HOTEL_ID}/contacts`]: (init) => {
      captured.created = JSON.parse(String(init?.body));
      return ok(hotelContactViewFixture());
    },
    [`/hotels-admin/hotels/${HOTEL_ID}/contacts/${CONTACT_ID}`]: (init) => {
      captured.updated = JSON.parse(String(init?.body));
      return ok(hotelContactViewFixture());
    },
  });
}

const noop = (): void => {};

describe("ContactEditSheet", () => {
  it("adds a contact: fills the fields, marks it primary and lower-cases the email", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <ContactEditSheet hotelId={HOTEL_ID} open contact={null} onClose={noop} />,
      contactFetch(captured),
    );
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Asha Rao");
    await fireEvent.changeText(screen.getByTestId("contact-email"), "Asha.Rao@Hotel.com");
    await fireEvent.press(screen.getByTestId("contact-primary"));
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Contact added")).toBeOnTheScreen();
    expect(captured.created).toMatchObject({
      name: "Asha Rao",
      email: "asha.rao@hotel.com",
      isPrimary: true,
    });
  });

  it("blocks submit on a malformed email", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <ContactEditSheet hotelId={HOTEL_ID} open contact={null} onClose={noop} />,
      contactFetch(captured),
    );
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Asha");
    await fireEvent.changeText(screen.getByTestId("contact-email"), "nope");
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Enter a valid email address")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a contact: seeds from it and patches the change", async () => {
    const captured: Captured = {};
    await renderWithApi(
      <ContactEditSheet
        hotelId={HOTEL_ID}
        open
        contact={hotelContactViewFixture()}
        onClose={noop}
      />,
      contactFetch(captured),
    );
    await screen.findByDisplayValue("Priya Sharma");
    await fireEvent.changeText(screen.getByTestId("contact-role"), "General Manager");
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Contact updated")).toBeOnTheScreen();
    expect(captured.updated).toMatchObject({ name: "Priya Sharma", roleTitle: "General Manager" });
  });
});
