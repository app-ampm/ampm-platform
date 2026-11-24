import { copyText } from "./copy-text";
import { shareText } from "./share-text";

describe("copying and sharing on a native build", () => {
  it("offers neither: no clipboard module, and no browser share sheet, so the text stays selectable", () => {
    expect(copyText).toBeNull();
    expect(shareText).toBeNull();
  });
});
