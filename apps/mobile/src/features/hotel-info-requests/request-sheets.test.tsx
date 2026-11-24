import type * as UiModule from "@ampm/ui";

import { TEST_API_BASE } from "../../test/api";
import { fireEvent, screen, waitFor } from "../../test/render";
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
 * A live request's sheets (D-188 §7) as staff meet them: a reissued link is shown once and forgotten when
 * the sheet closes, and a sheet whose reissue is under way cannot be closed (scrim, close button or
 * Escape), or the link the server issues would never be shown.
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
