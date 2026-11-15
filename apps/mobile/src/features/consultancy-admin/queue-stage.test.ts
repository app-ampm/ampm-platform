import { enquiryHref, parseQueueStage, queueHref } from "./queue-stage";

describe("the queue's stage in the address", () => {
  it("reads a known stage, and nothing for a missing or unknown one", () => {
    expect(parseQueueStage("client_decision")).toBe("client_decision");
    expect(parseQueueStage(["proposal", "new"])).toBe("proposal");
    expect(parseQueueStage(undefined)).toBeNull();
    expect(parseQueueStage("nowhere")).toBeNull();
  });

  it("carries the stage onto the queue's and an enquiry's paths", () => {
    expect(queueHref(null)).toBe("/enquiries");
    expect(queueHref("closed")).toBe("/enquiries?stage=closed");
    expect(enquiryHref("abc", null)).toBe("/enquiries/abc");
    expect(enquiryHref("abc", "with_hotel")).toBe("/enquiries/abc?stage=with_hotel");
  });
});
