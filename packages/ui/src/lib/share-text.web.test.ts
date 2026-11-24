/*
 * The browser's share sheet (the Web Share API): offered only where the browser has one, decided when the
 * module loads, so each case loads it afresh. Never a `wa.me` link (plan §4.2).
 */

type ShareText = ((text: string) => Promise<boolean>) | null;

/** Loads the module afresh, after `share` (or nothing) is put on the browser's navigator. */
function load(share?: (data: ShareData) => Promise<void>): {
  readonly shareText: ShareText;
  readonly share: jest.Mock | undefined;
} {
  const mock = share ? jest.fn(share) : undefined;
  if (mock) Object.defineProperty(navigator, "share", { value: mock, configurable: true });
  let shareText: ShareText = null;
  jest.isolateModules(() => {
    ({ shareText } = jest.requireActual<{ shareText: ShareText }>("./share-text.web"));
  });
  return { shareText, share: mock };
}

describe("shareText on the web", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "share");
  });

  it("is not offered where the browser has no share sheet", () => {
    expect(load().shareText).toBeNull();
  });

  it("hands the text itself to the share sheet, never a wa.me link, and says it was shared", async () => {
    const { shareText, share } = load(() => Promise.resolve());
    const url = "https://site.synthetic.example/hotel-form#k=hfl_x";
    expect(await shareText?.(url)).toBe(true);
    expect(share).toHaveBeenCalledWith({ text: url });
    expect(JSON.stringify(share?.mock.calls)).not.toContain("wa.me");
  });

  it("says no when the person cancels or the browser refuses", async () => {
    const abort = Object.assign(new Error("cancelled"), { name: "AbortError" });
    const { shareText } = load(() => Promise.reject(abort));
    expect(await shareText?.("text")).toBe(false);
  });
});
