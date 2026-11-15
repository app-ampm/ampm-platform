import { filteredEmptyCopy } from "./enquiry-queue-states";

describe("filteredEmptyCopy", () => {
  it("says nothing special for an unfiltered queue", () => {
    expect(filteredEmptyCopy(null, null)).toBeNull();
  });

  it("names the stage when only a stage is chosen", () => {
    expect(filteredEmptyCopy("closed", null)?.title).toBe("Nothing at this stage");
  });

  it("names the owner filter first, with the stage folded into the line", () => {
    expect(filteredEmptyCopy(null, "me")).toEqual({
      title: "Nothing of yours open",
      description: "No open enquiry is assigned to you. Choose Everyone to see the whole queue.",
    });
    expect(filteredEmptyCopy("new", "unassigned")).toEqual({
      title: "Nothing waiting for an owner",
      description: "Every open enquiry at this stage has someone on the hotel team on it.",
    });
  });
});
