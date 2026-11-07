import {
  auditActionLabel,
  auditActionTone,
  auditActorLabel,
  formatMoment,
} from "./audit-log.format";
import { auditEventFixture } from "./admin.test-utils";

describe("audit-log.format", () => {
  it("labels actions and gives a deletion the danger tone", () => {
    expect(auditActionLabel("create")).toBe("Create");
    expect(auditActionLabel("restricted_read")).toBe("Restricted read");
    expect(auditActionTone("delete")).toBe("danger");
    expect(auditActionTone("create")).toBe("success");
    expect(auditActionTone("update")).toBe("info");
  });

  it("names the actor kind", () => {
    expect(auditActorLabel("user")).toBe("Staff");
    expect(auditActorLabel("system")).toBe("System");
    expect(auditActorLabel("guest_token")).toBe("Guest");
  });

  it("formats a moment and leaves a bad date untouched", () => {
    expect(formatMoment(auditEventFixture().occurredAt)).toMatch(/·/);
    expect(formatMoment("not-a-date")).toBe("not-a-date");
  });
});
