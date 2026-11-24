import { HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL } from "@ampm/core";
import type * as UiModule from "@ampm/ui";

import { TEST_API_BASE } from "../../test/api";
import { fireEvent, screen, waitFor, within } from "../../test/render";
import {
  failure,
  ISSUED_URL,
  linkIssuedFixture,
  ok,
  REQUEST_ID,
  renderWithApi,
  requestFullFixture,
  type FetchFn,
} from "./info-requests.test-utils";
import { RequestActions } from "./request-actions";

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  copyText: () => Promise.resolve(true),
  shareText: null,
}));

jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 1280, height: 900, scale: 2, fontScale: 1 }),
}));

/*
 * A live request's sheets (D-188 §7) as staff meet them: each shows the API's own message when it refuses
 * (reissue, revoke, extend, edit, record share); a reissued link is shown once and forgotten when the
 * sheet closes; and a sheet whose reissue is under way cannot be closed (scrim, close button or Escape),
 * or the link the server issues would never be shown.
 */

const REQUEST = `/hotels-admin/info-requests/${REQUEST_ID}`;

type Answer = () => Response | Promise<Response>;

/** What each route answers unless a test says otherwise: success, as the API would. */
const SUCCESS: Readonly<Record<string, Answer>> = {
  "/hotels-admin/hotel-form-mode": () => ok({ mode: "on" }),
  [REQUEST]: () => ok(requestFullFixture()),
  [`${REQUEST}/reissue`]: () =>
    ok(linkIssuedFixture({ request: requestFullFixture({ tokenGeneration: 2 }) })),
  [`${REQUEST}/revoke`]: () => ok(requestFullFixture({ status: "revoked" })),
  [`${REQUEST}/share-record`]: () => ok(requestFullFixture()),
};

/** The bodies the sheets sent, by path. */
type Sent = Record<string, unknown>;

/** A fetch answering by path, the test's answers over SUCCESS, recording each body sent. */
function actionsFetch(answers: Readonly<Record<string, Answer>>, sent: Sent): FetchFn {
  return async (input, init) => {
    const path = String(input).replace(TEST_API_BASE, "").split("?")[0] ?? "";
    if (typeof init?.body === "string") sent[path] = JSON.parse(init.body);
    const answer = answers[path] ?? SUCCESS[path];
    return answer ? answer() : failure("not_found", 404);
  };
}

async function renderActions(
  answers: Readonly<Record<string, Answer>> = {},
  sent: Sent = {},
): Promise<void> {
  await renderWithApi(
    <RequestActions request={requestFullFixture()} />,
    actionsFetch(answers, sent),
  );
}

/** An API refusal in its envelope: the code, the message staff read, and the field a 400 names. */
function refusal(status: number, code: string, message: string, path?: string): Response {
  const details = path === undefined ? {} : { details: [{ path, message }] };
  return new Response(JSON.stringify({ error: { code, message, ...details } }), { status });
}

/** An answer the test gives when it chooses: a request still under way until then. */
function heldAnswer() {
  let give = (_response: Response): void => undefined;
  const answer = new Promise<Response>((resolve) => (give = resolve));
  return { answer: () => answer, give };
}

describe("the reissued link", () => {
  it("is shown once: closing the sheet forgets it, and reopening asks again", async () => {
    await renderActions();
    await fireEvent.press(screen.getByTestId("request-reissue"));
    await fireEvent.press(await screen.findByTestId("reissue-submit"));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText(ISSUED_URL)).toBeNull());
    await fireEvent.press(screen.getByTestId("request-reissue"));
    expect(await screen.findByTestId("reissue-submit")).toBeOnTheScreen();
    expect(screen.queryByText(ISSUED_URL, { includeHiddenElements: true })).toBeNull();
    expect(screen.queryByText("Shown only now", { includeHiddenElements: true })).toBeNull();
  });

  it("keeps the sheet open while the reissue is under way, so the new link is shown", async () => {
    const held = heldAnswer();
    await renderActions({ [`${REQUEST}/reissue`]: held.answer });
    await fireEvent.press(screen.getByTestId("request-reissue"));
    await fireEvent.press(await screen.findByTestId("reissue-submit"));
    await fireEvent.press(screen.getByTestId("reissue-scrim", { includeHiddenElements: true }));
    await fireEvent.press(screen.getByRole("button", { name: "Close" }));
    // Escape on the web and the back gesture on Android: the modal's close request.
    await fireEvent(screen.getByTestId("reissue"), "requestClose");
    expect(screen.getByTestId("reissue-submit")).toBeOnTheScreen();
    held.give(ok(linkIssuedFixture({ request: requestFullFixture({ tokenGeneration: 2 }) })));
    expect(await screen.findByText(ISSUED_URL)).toBeOnTheScreen();
    expect(screen.getByText("Shown only now")).toBeOnTheScreen();
  });
});

describe("a refusal shows the API's own message in its sheet", () => {
  const changed = "This request changed meanwhile: reload it and try again";

  it("on a reissue, above the warning, with no link", async () => {
    await renderActions({ [`${REQUEST}/reissue`]: () => refusal(409, "conflict", changed) });
    await fireEvent.press(screen.getByTestId("request-reissue"));
    await fireEvent.press(await screen.findByTestId("reissue-submit"));
    expect(await screen.findByTestId("reissue-refusal")).toHaveTextContent(changed);
    expect(screen.queryByText(ISSUED_URL)).toBeNull();
  });

  it("on a revoke, under the reason", async () => {
    const message = "A submitted request is with the reviewers: reject it rather than revoke it";
    await renderActions({ [`${REQUEST}/revoke`]: () => refusal(409, "conflict", message) });
    await fireEvent.press(screen.getByTestId("request-revoke"));
    await fireEvent.changeText(
      await screen.findByTestId("revoke-request-reason"),
      "Sent to the wrong hotel",
    );
    await fireEvent.press(screen.getByTestId("revoke-request-confirm"));
    const sheet = screen.getByTestId("revoke-request");
    expect(await within(sheet).findByText(message)).toBeOnTheScreen();
  });

  it("on an extension, under the days", async () => {
    const message = "This link can be extended to 22 Feb 2099 at the latest";
    const sent: Sent = {};
    await renderActions(
      { [REQUEST]: () => refusal(400, "validation_failed", message, "extendDays") },
      sent,
    );
    await fireEvent.press(screen.getByTestId("request-extend"));
    await fireEvent.changeText(await screen.findByTestId("extend-days"), "7");
    await fireEvent.press(screen.getByTestId("extend-submit"));
    const sheet = screen.getByTestId("extend");
    expect(await within(sheet).findByText(message)).toBeOnTheScreen();
    expect(sent[REQUEST]).toEqual({ extendDays: 7 });
  });

  it("on an edit, at the top of the sheet", async () => {
    const message = "A revoked request is read-only";
    await renderActions({ [REQUEST]: () => refusal(409, "conflict", message) });
    await fireEvent.press(screen.getByTestId("request-edit"));
    await fireEvent.changeText(await screen.findByTestId("edit-request-label"), "Lake refresh");
    await fireEvent.press(screen.getByTestId("edit-request-submit"));
    expect(await screen.findByTestId("edit-request-refusal")).toHaveTextContent(message);
  });

  it("on a recorded share, under the form", async () => {
    const message = "A revoked request is read-only";
    await renderActions({ [`${REQUEST}/share-record`]: () => refusal(409, "conflict", message) });
    await fireEvent.press(screen.getByTestId("request-share"));
    await fireEvent.press(await screen.findByTestId("record-share-form-channel-copy"));
    await fireEvent.press(screen.getByTestId("record-share-form-submit"));
    expect(await screen.findByTestId("record-share-form-refused")).toHaveTextContent(message);
  });
});

describe("a hotel form link pasted into a label or note", () => {
  it("is refused under the edit's label in the contract's words, and nothing is sent", async () => {
    const sent: Sent = {};
    await renderActions({}, sent);
    await fireEvent.press(screen.getByTestId("request-edit"));
    await fireEvent.changeText(
      await screen.findByTestId("edit-request-label"),
      `Sent ${ISSUED_URL}`,
    );
    await fireEvent.press(screen.getByTestId("edit-request-submit"));
    const sheet = screen.getByTestId("edit-request");
    expect(
      await within(sheet).findByText(HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL),
    ).toBeOnTheScreen();
    expect(sent[REQUEST]).toBeUndefined();
  });

  it("is refused under a share's note in the contract's words, and nothing is sent", async () => {
    const sent: Sent = {};
    await renderActions({}, sent);
    await fireEvent.press(screen.getByTestId("request-share"));
    await fireEvent.press(await screen.findByTestId("record-share-form-channel-whatsapp"));
    await fireEvent.changeText(
      screen.getByTestId("record-share-form-note"),
      `To the GM: ${ISSUED_URL}`,
    );
    await fireEvent.press(screen.getByTestId("record-share-form-submit"));
    const sheet = screen.getByTestId("record-share");
    expect(
      await within(sheet).findByText(HOTEL_INFO_REQUEST_PASTED_LINK_REFUSAL),
    ).toBeOnTheScreen();
    expect(sent[`${REQUEST}/share-record`]).toBeUndefined();
  });
});
