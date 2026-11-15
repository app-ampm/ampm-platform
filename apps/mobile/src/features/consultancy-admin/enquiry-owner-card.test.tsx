import type { HotelEnquiryStaffView } from "@ampm/core";

import { fireEvent, screen, within } from "../../test/render";
import {
  ENQUIRY_ID,
  ME_ID,
  ME_NAME,
  STAFF_USER_ID,
  STAFF_USER_NAME,
  enquiryFixture,
  failure,
  hotelTeamMeFixture,
  jsonResponse,
  ok,
  renderWithApi,
  routedFetch,
  type Route,
  type SentRequest,
} from "./consultancy-admin.test-utils";
import { EnquiryOwnerCard, ownerOptions } from "./enquiry-owner-card";

const ASSIGNEES = "GET /consultancy-admin/enquiries/assignees";
const UPDATE = `PATCH /consultancy-admin/enquiries/${ENQUIRY_ID}`;
const TEAM = [
  { id: ME_ID, name: ME_NAME },
  { id: STAFF_USER_ID, name: STAFF_USER_NAME },
];

/** The card for one enquiry, signed in as the hotel team; the PATCH echoes the owner it was sent. */
async function renderCard(
  enquiry: HotelEnquiryStaffView,
  { routes = {}, sent = [] }: { routes?: Record<string, Route>; sent?: SentRequest[] } = {},
): Promise<SentRequest[]> {
  const fetchImpl = routedFetch(
    {
      "GET /me": () => ok(hotelTeamMeFixture()),
      [ASSIGNEES]: () => ok(TEAM),
      [UPDATE]: (init) => {
        const body = JSON.parse(String(init?.body)) as { assignedUserId: string | null };
        return ok(enquiryFixture({ assignedUserId: body.assignedUserId }));
      },
      ...routes,
    },
    sent,
  );
  await renderWithApi(<EnquiryOwnerCard enquiry={enquiry} />, fetchImpl);
  return sent;
}

const patches = (sent: readonly SentRequest[]) =>
  sent.filter((request) => request.method === "PATCH").map((request) => request.body);

describe("EnquiryOwnerCard", () => {
  it("says nobody holds a new enquiry and lets a hotel-team member take it in one press", async () => {
    const sent = await renderCard(enquiryFixture());
    const card = await screen.findByTestId("enquiry-owner-card");
    expect(within(card).getByTestId("enquiry-owner-name")).toHaveTextContent("Unassigned");
    expect(within(card).getByText(/nobody on the hotel team/i)).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId("enquiry-assign-me"));
    expect(await screen.findByText("Assigned to you")).toBeOnTheScreen();
    expect(patches(sent)).toEqual([{ assignedUserId: ME_ID }]);
  });

  it("hands the enquiry to someone else on the team from the picker", async () => {
    const sent = await renderCard(enquiryFixture());
    await fireEvent.press(await screen.findByTestId("enquiry-owner-select"));
    // The reader is marked as themself among the team.
    expect(screen.getByText("You")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId(`enquiry-owner-select-option-${STAFF_USER_ID}`));
    expect(await screen.findByText(`Assigned to ${STAFF_USER_NAME}`)).toBeOnTheScreen();
    expect(patches(sent)).toEqual([{ assignedUserId: STAFF_USER_ID }]);
  });

  it("names the holder, offers no Assign to me on their own, and can send it back to nobody", async () => {
    const sent = await renderCard(
      enquiryFixture({ assignedUserId: ME_ID, assignedUserName: ME_NAME }),
    );
    expect(await screen.findByTestId("enquiry-owner-name")).toHaveTextContent(ME_NAME);
    // Once /me says who is reading.
    expect(await screen.findByText(/^You hold this enquiry/)).toBeOnTheScreen();
    await screen.findByTestId("enquiry-owner-select");
    expect(screen.queryByTestId("enquiry-assign-me")).toBeNull();
    await fireEvent.press(screen.getByTestId("enquiry-owner-select"));
    await fireEvent.press(screen.getByTestId("enquiry-owner-select-option-nobody"));
    expect(await screen.findByText("Back to unassigned")).toBeOnTheScreen();
    expect(patches(sent)).toEqual([{ assignedUserId: null }]);
  });

  it("says why when the server refuses the owner", async () => {
    const refusal = () =>
      jsonResponse(
        {
          error: {
            code: "validation_failed",
            message: "Choose someone on the hotel team who can work this enquiry",
            details: [{ path: "assignedUserId", message: "Choose someone on the hotel team" }],
          },
        },
        400,
      );
    await renderCard(enquiryFixture(), { routes: { [UPDATE]: refusal } });
    await fireEvent.press(await screen.findByTestId("enquiry-assign-me"));
    expect(
      await screen.findByText("Choose someone on the hotel team who can work this enquiry"),
    ).toBeOnTheScreen();
  });

  it("shows a reader who may not reassign the holder only", async () => {
    await renderCard(
      enquiryFixture({ assignedUserId: STAFF_USER_ID, assignedUserName: STAFF_USER_NAME }),
      { routes: { [ASSIGNEES]: () => failure("forbidden", 403) } },
    );
    expect(await screen.findByTestId("enquiry-owner-name")).toHaveTextContent(STAFF_USER_NAME);
    expect(screen.queryByTestId("enquiry-owner-select")).toBeNull();
    expect(screen.queryByTestId("enquiry-assign-me")).toBeNull();
  });

  it("leaves a closed enquiry's holder as history, without asking for the team", async () => {
    const closed = enquiryFixture({
      status: "closed",
      assignedUserId: STAFF_USER_ID,
      assignedUserName: STAFF_USER_NAME,
    });
    const sent = await renderCard(closed);
    expect(await screen.findByTestId("enquiry-owner-name")).toHaveTextContent(STAFF_USER_NAME);
    expect(screen.queryByTestId("enquiry-owner-select")).toBeNull();
    expect(sent.some((request) => request.path.endsWith("/assignees"))).toBe(false);
  });
});

describe("ownerOptions", () => {
  it("keeps a holder who left the team, named but not choosable, and offers Nobody", () => {
    const gone = "018f0000-0000-7000-8000-0000000000aa";
    const options = ownerOptions(
      TEAM,
      enquiryFixture({ assignedUserId: gone, assignedUserName: "Ravi Rao" }),
      ME_ID,
    );
    expect(options.map((option) => option.label)).toEqual([
      ME_NAME,
      STAFF_USER_NAME,
      "Ravi Rao",
      "Nobody",
    ]);
    expect(options.find((option) => option.value === gone)?.disabled).toBe(true);
    expect(options[0]?.description).toBe("You");
  });

  it("offers no Nobody while nobody holds it", () => {
    const options = ownerOptions(TEAM, enquiryFixture(), ME_ID);
    expect(options.map((option) => option.value)).toEqual([ME_ID, STAFF_USER_ID]);
  });
});
