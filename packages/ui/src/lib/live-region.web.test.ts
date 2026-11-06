import {
  FIRST_MESSAGE_DELAY_MS,
  LIVE_REGION_ID,
  MESSAGE_LIFETIME_MS,
  announcePolitely,
} from "./live-region.web";

const region = () => document.getElementById(LIVE_REGION_ID);
const lines = () => [...(region()?.children ?? [])].map((line) => line.textContent);

describe("the web's live region", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    region()?.remove();
  });

  it("is one polite log, off screen but read, that exists before its first message", () => {
    announcePolitely("Saved. All good");
    const node = region();
    expect(node?.getAttribute("role")).toBe("log");
    expect(node?.getAttribute("aria-live")).toBe("polite");
    expect(node?.getAttribute("aria-relevant")).toBe("additions");
    expect(node?.className).toBe("web:sr-only");
    // The text arrives after the region is in the page: a region added with its text is not spoken.
    expect(lines()).toEqual([]);
    jest.advanceTimersByTime(FIRST_MESSAGE_DELAY_MS);
    expect(lines()).toEqual(["Saved. All good"]);
  });

  it("writes later messages straight in, the same words twice as two changes", () => {
    announcePolitely("Offline.");
    jest.advanceTimersByTime(FIRST_MESSAGE_DELAY_MS);
    announcePolitely("Offline.");
    expect(lines()).toEqual(["Offline.", "Offline."]);
    expect(document.querySelectorAll(`#${LIVE_REGION_ID}`)).toHaveLength(1);
  });

  it("lets messages go after a while, so nothing piles up", () => {
    announcePolitely("Request sent");
    jest.advanceTimersByTime(FIRST_MESSAGE_DELAY_MS + MESSAGE_LIFETIME_MS);
    expect(lines()).toEqual([]);
    expect(region()).not.toBeNull();
  });

  it("ignores an empty message", () => {
    announcePolitely("");
    expect(region()).toBeNull();
  });
});
