import { HOTEL_PHONE_REFUSAL } from "@ampm/core";

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

async function renderNew(captured: Captured): Promise<void> {
  await renderWithApi(
    <ContactEditSheet hotelId={HOTEL_ID} open contact={null} onClose={noop} />,
    contactFetch(captured),
  );
}

describe("ContactEditSheet", () => {
  it("adds a contact: marks it primary, lower-cases the email and saves the phone in E.164", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Asha Rao");
    await fireEvent.changeText(screen.getByTestId("contact-email"), "Asha.Rao@Hotel.example");
    await fireEvent.changeText(screen.getByTestId("contact-phone"), "0123-456 7890");
    expect(screen.getByText("Saved as +911234567890")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("contact-primary"));
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Contact added")).toBeOnTheScreen();
    expect(captured.created).toEqual({
      name: "Asha Rao",
      roleTitle: null,
      phone: "+911234567890",
      email: "asha.rao@hotel.example",
      isPrimary: true,
    });
  });

  it("says making a contact primary replaces the current one", async () => {
    await renderNew({});
    expect(
      await screen.findByText("Making this the primary contact replaces the current one"),
    ).toBeOnTheScreen();
  });

  it("shows why a phone is refused as it is typed, and blocks the save on it", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Asha");
    await fireEvent.changeText(screen.getByTestId("contact-phone"), "0141 234 5678 ext 12");
    expect(screen.getByText(HOTEL_PHONE_REFUSAL)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(screen.getByText(HOTEL_PHONE_REFUSAL)).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("blocks submit on a malformed email", async () => {
    const captured: Captured = {};
    await renderNew(captured);
    await fireEvent.changeText(await screen.findByTestId("contact-name"), "Asha");
    await fireEvent.changeText(screen.getByTestId("contact-email"), "nope");
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Enter a valid email address")).toBeOnTheScreen();
    expect(captured.created).toBeUndefined();
  });

  it("edits a contact: sends only the change, never a phone it did not touch", async () => {
    const captured: Captured = {};
    const contact = hotelContactViewFixture({ phone: "12345 678 ext 9" });
    await renderWithApi(
      <ContactEditSheet hotelId={HOTEL_ID} open contact={contact} onClose={noop} />,
      contactFetch(captured),
    );
    await screen.findByDisplayValue("Priya Sharma");
    expect(screen.getByText("Saved as 12345 678 ext 9")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("contact-role"), "General Manager");
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Contact updated")).toBeOnTheScreen();
    expect(captured.updated).toEqual({ roleTitle: "General Manager" });
  });

  it("sends a retyped phone in E.164", async () => {
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
    await fireEvent.changeText(await screen.findByTestId("contact-phone"), "+91 12345 67802");
    await fireEvent.press(screen.getByTestId("contact-edit-submit"));
    expect(await screen.findByText("Contact updated")).toBeOnTheScreen();
    expect(captured.updated).toEqual({ phone: "+911234567802" });
  });
});
