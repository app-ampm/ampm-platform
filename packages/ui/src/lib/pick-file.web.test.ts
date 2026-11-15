import { pickFile } from "./pick-file.web";

/** Stands in for the browser's file dialog: the next input clicked "chooses" `files`. */
function chooseOnClick(files: File[]): { readonly accepted: () => string } {
  let accepted = "";
  jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation(function (
    this: HTMLInputElement,
  ) {
    accepted = this.accept;
    Object.defineProperty(this, "files", { value: files });
    this.onchange?.(new Event("change"));
  });
  return { accepted: () => accepted };
}

describe("pickFile on the web", () => {
  afterEach(() => jest.restoreAllMocks());

  it("opens a file input narrowed to `accept` and resolves with the chosen file", async () => {
    const contract = new File(["%PDF-1.4"], "signed.pdf", { type: "application/pdf" });
    const dialog = chooseOnClick([contract]);
    const picked = await pickFile("application/pdf,image/png");
    expect(dialog.accepted()).toBe("application/pdf,image/png");
    expect(picked).toEqual({
      file: contract,
      mimeType: "application/pdf",
      sizeBytes: 8,
      name: "signed.pdf",
    });
  });

  it("falls back to octet-stream for a file the browser cannot type", async () => {
    chooseOnClick([new File(["x"], "scan.heic")]);
    expect((await pickFile("image/*"))?.mimeType).toBe("application/octet-stream");
  });

  it("resolves null when nothing was chosen", async () => {
    chooseOnClick([]);
    expect(await pickFile("image/*")).toBeNull();
  });
});
