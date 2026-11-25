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

  it("redacts the hotel information form's names (D-188 §6, plan §6.2) in every spelling", () => {
    const names = [
      "mobile",
      "oneTimeCode",
      "linkToken",
      "formSessionToken",
      "sessionToken",
      "botToken",
      "codeHmac",
      "destinationHash",
      "recipientAddress",
      "recipientEmail",
      "recipientName",
      "fullName",
      "designation",
      "userAgent",
      "originalName",
      "tokenHash",
      "sessionTokenHash",
    ];
    const camel = Object.fromEntries(names.map((name) => [name, "synthetic"]));
    const snake = Object.fromEntries(
      names.map((name) => [name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), "x"]),
    );
    for (const [key, value] of Object.entries(redact(camel) as Record<string, unknown>)) {
      expect(value, key).toBe("[redacted]");
    }
    for (const [key, value] of Object.entries(redact(snake) as Record<string, unknown>)) {
      expect(value, key).toBe("[redacted]");
    }
    expect(redact({ "User-Agent": "Synthetic/1.0" })).toEqual({ "User-Agent": "[redacted]" });
  });

  it("masks synthetic request and notification rows, keeping what identifies them", () => {
    const request = {
      id: "0196a0b0-0000-7000-8000-000000000001",
      reference: "HIR-2026-0001",
      status: "open",
      tokenHash: "a".repeat(64),
      tokenGeneration: 2,
      recipientName: "Synthetic Sales Lead",
      recipientEmail: "sales@synthetic-hotel.example",
    };
    expect(redact(request)).toEqual({
      ...request,
      tokenHash: "[redacted]",
      recipientName: "[redacted]",
      recipientEmail: "[redacted]",
    });
    const notification = {
      recipientType: "external",
      recipientId: request.id,
      recipientAddress: "sales@synthetic-hotel.example",
      replyTo: "desk@ampm.example",
    };
    expect(redact(notification)).toEqual({ ...notification, recipientAddress: "[redacted]" });
    const person = { fullName: "Synthetic Person", designation: "Sales", mobile: "+919000000001" };
    expect(Object.values(redact(person) as Record<string, unknown>)).toEqual([
      "[redacted]",
      "[redacted]",
      "[redacted]",
    ]);
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
