import type { AuditEventView } from "@ampm/core";

import { auditCsv } from "./audit-log.csv";

const HEADER = "When (UTC),Action,Actor,Entity type,Entity ID,IP address,Request ID";

function event(overrides: Partial<AuditEventView> = {}): AuditEventView {
  return {
    id: "018f0000-0000-7000-8000-00000000e001",
    actorUserId: "018f0000-0000-7000-8000-00000000e0a1",
    actorType: "user",
    action: "update",
    entityType: "staff_user",
    entityId: "018f0000-0000-7000-8000-00000000e0b1",
    projectId: null,
    before: null,
    after: null,
    ipAddress: "203.0.113.4",
    requestId: "req-123",
    occurredAt: "2026-11-05T18:02:00.000Z",
    ...overrides,
  };
}

describe("auditCsv", () => {
  it("writes a header and one CRLF-separated row per event, with the ISO time and labels", () => {
    const [header, row] = auditCsv([event()]).split("\r\n");
    expect(header).toBe(HEADER);
    expect(row).toBe(
      "2026-11-05T18:02:00.000Z,Update,Staff,staff_user,018f0000-0000-7000-8000-00000000e0b1,203.0.113.4,req-123",
    );
  });

  it("escapes fields with commas or quotes, and blanks a null ip and request id", () => {
    const row = auditCsv([event({ entityType: 'a, "b"', ipAddress: null, requestId: null })]).split(
      "\r\n",
    )[1];
    expect(row).toContain('"a, ""b"""');
    expect(row!.endsWith(",,")).toBe(true);
  });

  it("is the header alone when there are no events", () => {
    expect(auditCsv([])).toBe(HEADER);
  });
});
