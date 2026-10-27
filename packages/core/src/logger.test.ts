import { describe, expect, it } from "vitest";

import { createLogger, createMemoryLogger, redact } from "./logger";

describe("logger", () => {
  it("redacts secrets and personal data at any depth", () => {
    expect(
      redact({
        authorization: "Bearer x",
        nested: { email: "a@b.c", ok: 1 },
        list: [{ token: "t" }],
      }),
    ).toEqual({
      authorization: "[redacted]",
      nested: { email: "[redacted]", ok: 1 },
      list: [{ token: "[redacted]" }],
    });
  });

  it("redacts the camelCase and header forms of the same keys (Prisma records, HTTP headers)", () => {
    expect(
      redact({
        tokenHash: "h",
        identitySubject: "s",
        ipAddress: "203.0.113.9",
        accessToken: "a",
        "Set-Cookie": "c",
        phoneNumber: "1",
        passwordHash: "p",
        apiKey: "k",
        mfaSecretRef: "m",
        emailVerified: true,
        tokenCount: 2,
      }),
    ).toEqual({
      tokenHash: "[redacted]",
      identitySubject: "[redacted]",
      ipAddress: "[redacted]",
      accessToken: "[redacted]",
      "Set-Cookie": "[redacted]",
      phoneNumber: "[redacted]",
      passwordHash: "[redacted]",
      apiKey: "[redacted]",
      mfaSecretRef: "[redacted]",
      emailVerified: true,
      tokenCount: 2,
    });
  });

  it("emits structured entries with inherited fields and respects the level", () => {
    const { logger, entries } = createMemoryLogger("info");
    const request = logger.child({ requestId: "r1" });
    request.debug("ignored");
    request.info("request.completed", { status: 200, password: "nope" });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      level: "info",
      event: "request.completed",
      fields: { requestId: "r1", status: 200, password: "[redacted]" },
    });
    expect(typeof createLogger().info).toBe("function");
  });
});
