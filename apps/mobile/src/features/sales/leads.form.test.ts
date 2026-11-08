import { buildActivityBody, emptyActivityDraft, followUpAt } from "./leads.form";

// 2026-11-08T10:00:00.000Z, so the follow-up offsets land on clean UTC days.
const NOW = Date.UTC(2026, 10, 8, 10, 0, 0);

describe("leads.form", () => {
  it("builds a minimal activity body — a blank note and no follow-up are omitted", () => {
    expect(buildActivityBody(emptyActivityDraft(), NOW)).toEqual({ activityType: "call" });
  });

  it("includes a trimmed note and the scheduled follow-up", () => {
    const body = buildActivityBody(
      { activityType: "meeting", summary: "  Met at the venue  ", followUp: "in_three_days" },
      NOW,
    );
    expect(body).toEqual({
      activityType: "meeting",
      summary: "Met at the venue",
      nextFollowUpAt: "2026-11-11T10:00:00.000Z",
    });
  });

  it("computes the follow-up datetime from now, or null for none", () => {
    expect(followUpAt("none", NOW)).toBeNull();
    expect(followUpAt("tomorrow", NOW)).toBe("2026-11-09T10:00:00.000Z");
    expect(followUpAt("next_week", NOW)).toBe("2026-11-15T10:00:00.000Z");
  });
});
