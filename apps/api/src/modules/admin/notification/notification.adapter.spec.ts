import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";

import { ConsoleNotificationAdapter } from "./notification.adapter.js";

describe("ConsoleNotificationAdapter", () => {
  it("returns a provider reference and logs the channel and template only", async () => {
    const { logger, entries } = createMemoryLogger();
    const adapter = new ConsoleNotificationAdapter(logger);
    const result = await adapter.send({
      channel: "email",
      recipientType: "user",
      recipientId: "user-1",
      templateKey: "welcome",
      body: "[welcome]",
    });
    expect(result.providerRef).toBe("console:email:welcome");
    const logged = entries.find((entry) => entry.event === "notification.console_delivery");
    expect(logged?.fields).toEqual({ channel: "email", templateKey: "welcome" });
    // Neither the recipient nor the body reaches the log (no personal data, security.md).
    expect(JSON.stringify(entries)).not.toContain("user-1");
    expect(JSON.stringify(entries)).not.toContain("[welcome]");
  });
});
