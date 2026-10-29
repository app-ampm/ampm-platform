import { createMemoryLogger } from "@ampm/core";
import { describe, expect, it } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { Env } from "../../../env.js";
import { ConsoleNotificationAdapter } from "./notification.adapter.js";
import { buildAdapters } from "./notification.module.js";
import { SmtpEmailAdapter } from "./smtp-email.adapter.js";

function env(overrides: Partial<Env> = {}): Env {
  return {
    EMAIL_PROVIDER: "console",
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    EMAIL_FROM: "AMPM <no-reply@localhost>",
    ...overrides,
  } as unknown as Env;
}

describe("buildAdapters (per-channel registry)", () => {
  it("routes email to the SMTP adapter when EMAIL_PROVIDER is smtp, and other channels to console", () => {
    const { logger } = createMemoryLogger();
    const registry = buildAdapters(
      env({ EMAIL_PROVIDER: "smtp", SMTP_HOST: "smtp.example" }),
      logger as unknown as AppLogger,
    );
    expect(registry.for("email")).toBeInstanceOf(SmtpEmailAdapter);
    for (const channel of ["sms", "whatsapp", "push"] as const) {
      expect(registry.for(channel)).toBeInstanceOf(ConsoleNotificationAdapter);
    }
  });

  it("routes email to the console stub when EMAIL_PROVIDER is console", () => {
    const { logger } = createMemoryLogger();
    const registry = buildAdapters(env(), logger as unknown as AppLogger);
    expect(registry.for("email")).toBeInstanceOf(ConsoleNotificationAdapter);
  });
});
