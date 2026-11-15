import { describe, expect, it } from "vitest";

import { staffEnquiriesPath } from "./use-staff-enquiries";

describe("staffEnquiriesPath", () => {
  it("is the bare queue with no filters", () => {
    expect(staffEnquiriesPath({})).toBe("/consultancy-admin/enquiries");
  });

  it("carries the holder filter beside the stage", () => {
    expect(staffEnquiriesPath({ assignee: "me" })).toBe("/consultancy-admin/enquiries?assignee=me");
    expect(staffEnquiriesPath({ stage: "new", assignee: "unassigned" })).toBe(
      "/consultancy-admin/enquiries?stage=new&assignee=unassigned",
    );
  });

  it("leaves an unset filter out rather than sending it empty", () => {
    expect(staffEnquiriesPath({ stage: undefined, assignee: undefined, cursor: "c1" })).toBe(
      "/consultancy-admin/enquiries?cursor=c1",
    );
  });
});
