import { enquiryHref, parseQueueAssignee, parseQueueStage, queueHref } from "./queue-filter";

describe("the queue's filters in the address", () => {
  it("reads a known stage, and nothing for a missing or unknown one", () => {
    expect(parseQueueStage("client_decision")).toBe("client_decision");
    expect(parseQueueStage(["proposal", "new"])).toBe("proposal");
    expect(parseQueueStage(undefined)).toBeNull();
    expect(parseQueueStage("nowhere")).toBeNull();
  });

  it("reads who holds it, and everyone's for a missing or unknown value", () => {
    expect(parseQueueAssignee("me")).toBe("me");
    expect(parseQueueAssignee(["unassigned", "me"])).toBe("unassigned");
    expect(parseQueueAssignee(undefined)).toBeNull();
    expect(parseQueueAssignee("someone")).toBeNull();
  });

  it("carries the stage onto the queue's and an enquiry's paths", () => {
    expect(queueHref(null)).toBe("/enquiries");
    expect(queueHref("closed")).toBe("/enquiries?stage=closed");
    expect(enquiryHref("abc", null)).toBe("/enquiries/abc");
    expect(enquiryHref("abc", "with_hotel")).toBe("/enquiries/abc?stage=with_hotel");
  });

  it("carries the holder filter beside the stage, or alone", () => {
    expect(queueHref(null, "me")).toBe("/enquiries?assignee=me");
    expect(queueHref("new", "unassigned")).toBe("/enquiries?stage=new&assignee=unassigned");
    expect(enquiryHref("abc", "proposal", "me")).toBe("/enquiries/abc?stage=proposal&assignee=me");
  });
});
