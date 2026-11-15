import { jsonResponse } from "../../test/api";
import { fireEvent, screen, waitFor } from "../../test/render";
import { agreementStanding } from "./agreement-actions";
import {
  ACCOUNT_ID,
  AGREEMENT_ID,
  agreementFixture,
  ENQUIRY_ID,
  ok,
  pageOf,
  renderWithApi,
} from "./commercial.fixtures";
import { AgreementSection } from "./enquiry-commercial";

const LIST = `GET /crm/service-agreements?hotelEnquiryId=${ENQUIRY_ID}`;
const STATUS = `PATCH /crm/service-agreements/${AGREEMENT_ID}/status`;
const CLIENT_USER = "018f0000-0000-7000-8000-0000000000d2";
const ACCEPTED_AT = "2026-11-15T17:22:05.761Z";

function renderAgreement(
  answer: () => Response | Promise<Response>,
  extra: Record<string, () => Response | Promise<Response>> = {},
) {
  return renderWithApi(<AgreementSection enquiryId={ENQUIRY_ID} accountId={ACCOUNT_ID} />, {
    [LIST]: answer,
    ...extra,
  });
}

const statusBodies = (sent: readonly { method: string; path: string; body: unknown }[]) =>
  sent.filter((request) => request.method === "PATCH").map((request) => request.body);

describe("AgreementActions — who does what (feature 10.2)", () => {
  it("sends a draft to the client", async () => {
    const sent = await renderAgreement(() => ok(pageOf([agreementFixture()])), {
      [STATUS]: () => ok(agreementFixture({ status: "sent" })),
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Send to client" }));
    await waitFor(() => expect(statusBodies(sent)).toEqual([{ status: "sent" }]));
  });

  it("never offers staff an accept: a sent agreement waits on the client, or is marked signed offline", async () => {
    await renderAgreement(() => ok(pageOf([agreementFixture({ status: "sent" })])));
    expect(
      await screen.findByText("Sent · waiting for the client to accept it in their portal."),
    ).toBeOnTheScreen();
    expect(screen.getByText("Sent · awaiting client")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Mark signed offline" })).toBeOnTheScreen();
    expect(screen.queryByRole("button", { name: /^Accept/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Activate/ })).toBeNull();
  });

  it("activates an agreement the client accepted, which starts the work", async () => {
    const accepted = agreementFixture({
      status: "accepted",
      acceptedAt: ACCEPTED_AT,
      acceptedByUserId: CLIENT_USER,
    });
    const sent = await renderAgreement(() => ok(pageOf([accepted])), {
      [STATUS]: () => ok(agreementFixture({ status: "active" })),
    });
    expect(
      await screen.findByText(
        "Accepted by the client on 15 Nov 2026. Activate it to start the paid work.",
      ),
    ).toBeOnTheScreen();
    expect(screen.getByText("Accepted · activate it")).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Activate: start the work" }));
    await waitFor(() => expect(statusBodies(sent)).toEqual([{ status: "active" }]));
  });

  it("says an agreement was signed outside the app, and opens its signed copy", async () => {
    await renderAgreement(() =>
      ok(
        pageOf([
          agreementFixture({
            status: "accepted",
            acceptedAt: ACCEPTED_AT,
            documentId: "018f0000-0000-7000-8000-0000000000aa",
          }),
        ]),
      ),
    );
    expect(
      await screen.findByText(/^Signed outside the app, recorded on 15 Nov 2026/),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "View signed copy" })).toBeOnTheScreen();
  });

  it("says why a move was refused, in the API's words, and re-reads the list", async () => {
    let reads = 0;
    await renderAgreement(
      () => {
        reads += 1;
        return ok(pageOf([agreementFixture({ status: "accepted", acceptedAt: ACCEPTED_AT })]));
      },
      {
        [STATUS]: () =>
          jsonResponse(
            {
              error: {
                code: "conflict",
                message: "An agreement cannot move from active to active",
              },
            },
            409,
          ),
      },
    );
    await fireEvent.press(await screen.findByRole("button", { name: "Activate: start the work" }));
    expect(
      await screen.findByText("An agreement cannot move from active to active"),
    ).toBeOnTheScreen();
    await waitFor(() => expect(reads).toBeGreaterThan(1));
  });

  it("asks before cancelling, since a cancelled agreement cannot be reopened", async () => {
    const sent = await renderAgreement(() => ok(pageOf([agreementFixture({ status: "sent" })])), {
      [STATUS]: () => ok(agreementFixture({ status: "cancelled" })),
    });
    await fireEvent.press(await screen.findByRole("button", { name: "Cancel agreement" }));
    expect(screen.getByText("Cancel the Rate negotiation agreement?")).toBeOnTheScreen();
    expect(statusBodies(sent)).toEqual([]);
    await fireEvent.press(screen.getAllByRole("button", { name: "Cancel agreement" }).at(-1)!);
    await waitFor(() => expect(statusBodies(sent)).toEqual([{ status: "cancelled" }]));
  });

  it("offers nothing on a finished agreement", () => {
    expect(agreementStanding(agreementFixture({ status: "completed" }))).toBeNull();
    expect(agreementStanding(agreementFixture({ status: "active" }))).toBe(
      "Active · the paid work can go ahead.",
    );
  });
});
