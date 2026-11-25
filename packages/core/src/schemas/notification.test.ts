import { describe, expect, it } from "vitest";

import { notificationView, recipientType } from "./notification";

describe("notification recipients", () => {
  it("are a user, a guest token, or an external address such as a hotel's (D-188 §5)", () => {
    expect(recipientType.options).toEqual(["user", "guest", "external"]);
  });

  it("never carry the recipient's address, or any recipient, in the view a person reads", () => {
    const keys = Object.keys(notificationView.shape);
    expect(keys).not.toContain("recipientAddress");
    expect(keys).not.toContain("recipientType");
    expect(keys).not.toContain("replyTo");
  });
});
