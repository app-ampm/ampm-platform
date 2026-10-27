import * as ui from "./index";

// code.md: new shared code is exported from the package index, so screens can reuse it.
describe("@ampm/ui index", () => {
  it("exports the announcement helpers screens compose with useAnnounce", () => {
    expect(ui.useAnnounce).toBeInstanceOf(Function);
    expect(ui.announcementText("Saved", "All good")).toBe("Saved. All good");
    expect(ui.isHiddenFromVoiceOver({ accessibilityElementsHidden: true })).toBe(true);
  });
});
