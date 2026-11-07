/// <reference types="node" />
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as ui from "./index";

// code.md: new shared code is exported from the package index, so screens can reuse it.
describe("@ampm/ui index", () => {
  it("exports the announcement helpers screens compose with useAnnounce", () => {
    expect(ui.useAnnounce).toBeInstanceOf(Function);
    expect(ui.announcementText("Saved", "All good")).toBe("Saved. All good");
    expect(ui.isHiddenFromVoiceOver({ accessibilityElementsHidden: true })).toBe(true);
  });

  it("exports every component folder", () => {
    const index = readFileSync(join(__dirname, "index.ts"), "utf8");
    const missing = readdirSync(join(__dirname, "components")).filter(
      (folder) => !index.includes(`export * from "./components/${folder}";`),
    );
    expect(missing).toEqual([]);
  });

  it("exports the Peacock Night kit screens are built from", () => {
    const kit = [ui.Screen, ui.ScreenHeader, ui.GlowBackdrop, ui.TabBar, ui.NavRail, ui.Card];
    const forms = [ui.Input, ui.OtpInput, ui.Toggle, ui.Checkbox, ui.SegmentedControl];
    const status = [ui.StatusChip, ui.Badge, ui.FilterChip, ui.ProgressBar, ui.Stepper];
    const content = [ui.ListItem, ui.InternalPanel, ui.Stat, ui.Avatar, ui.AvatarGroup];
    const feedback = [ui.OfflineBanner, ui.PhotoPlaceholder, ui.AnimatedView, ui.useGlassBlur];
    for (const part of [...kit, ...forms, ...status, ...content, ...feedback]) {
      expect(part).toBeDefined();
    }
  });
});
