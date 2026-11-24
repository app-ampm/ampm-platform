import { AccessibilityInfo } from "react-native";

import type * as UiModule from "@ampm/ui";

import { screen } from "../../test/render";
import {
  ISSUED_URL,
  linkIssuedFixture,
  renderWithApi,
  routedFetch,
} from "./info-requests.test-utils";
import { IssuedLink } from "./issued-link";

jest.mock("@ampm/ui", () => ({
  ...jest.requireActual<typeof UiModule>("@ampm/ui"),
  copyText: () => Promise.resolve(true),
  shareText: null,
}));

/*
 * A request's link, shown once (D-188 §7). The tests run as iOS (jest-expo/ios), where a live region does
 * not speak: VoiceOver hears that the link is shown only now only if it is announced as it appears.
 */
describe("IssuedLink", () => {
  afterEach(() => jest.restoreAllMocks());

  it("announces that the link is shown only now as it appears, and never reads the link out", async () => {
    const announce = jest.spyOn(AccessibilityInfo, "announceForAccessibilityWithOptions");
    announce.mockClear();
    await renderWithApi(
      <IssuedLink issued={linkIssuedFixture()} canRecordShare={false} />,
      routedFetch({}),
    );
    expect(screen.getByTestId("issued-link-warning")).toBeOnTheScreen();
    expect(announce).toHaveBeenCalledTimes(1);
    expect(announce).toHaveBeenCalledWith(
      expect.stringMatching(/^Shown only now\. Copy or share this link now: AMPM keeps no copy/),
      { queue: true },
    );
    expect(JSON.stringify(announce.mock.calls)).not.toContain(ISSUED_URL);
  });
});
