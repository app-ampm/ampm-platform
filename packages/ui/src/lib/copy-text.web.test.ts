import { copyText } from "./copy-text.web";

/** Gives jsdom a clipboard whose `writeText` does what `write` does. */
function clipboard(write: (text: string) => Promise<void>): jest.Mock {
  const writeText = jest.fn(write);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  return writeText;
}

describe("copyText on the web", () => {
  afterEach(() => {
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("puts the text on the clipboard and says so", async () => {
    const writeText = clipboard(() => Promise.resolve());
    expect(await copyText?.("https://site.synthetic.example/hotel-form#k=hfl_x")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("https://site.synthetic.example/hotel-form#k=hfl_x");
  });

  it("says no when the browser refuses, so the caller can say to copy it by hand", async () => {
    clipboard(() => Promise.reject(new Error("NotAllowedError")));
    expect(await copyText?.("text")).toBe(false);
  });

  it("says no on an insecure page, where the browser has no clipboard", async () => {
    expect(await copyText?.("text")).toBe(false);
  });
});
