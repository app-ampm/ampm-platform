import { Test } from "@nestjs/testing";
import { describe, expect, it, vi } from "vitest";

import { ENV, loadEnv } from "../../env.js";
import {
  BOT_CHECK_ADAPTER,
  SiteverifyBotCheckAdapter,
  StubBotCheckAdapter,
} from "./bot-check.adapter.js";
import { botCheckAdapterFor, BotCheckModule } from "./bot-check.module.js";
import { AppLogger } from "../logger.service.js";

/* The bot check is one provider for every module that imports BotCheckModule (D-189 §7). */

const development = {
  DATABASE_URL: "postgres://localhost:5432/ampm",
  IDENTITY_PROVIDER: "local",
  // Built at run time, so no secret-looking literal sits in the repository.
  IDENTITY_LOCAL_SECRET: "l".repeat(40),
};
const logger = { warn: vi.fn() };

describe("botCheckAdapterFor", () => {
  it("is the stub until a siteverify provider is configured with its URL and secret", () => {
    expect(botCheckAdapterFor(loadEnv(development), logger)).toBeInstanceOf(StubBotCheckAdapter);
    const siteverify = loadEnv({
      ...development,
      BOT_CHECK_PROVIDER: "siteverify",
      BOT_CHECK_URL: "https://verify.example/siteverify",
      BOT_CHECK_SECRET: "b".repeat(24),
    });
    expect(botCheckAdapterFor(siteverify, logger)).toBeInstanceOf(SiteverifyBotCheckAdapter);
  });
});

describe("BotCheckModule", () => {
  it("exports the adapter to the module that imports it", async () => {
    const moduleRef = await Test.createTestingModule({ imports: [BotCheckModule] })
      .useMocker((token) => {
        if (token === ENV) return loadEnv(development);
        if (token === AppLogger) return logger;
        return undefined;
      })
      .compile();
    expect(moduleRef.get(BOT_CHECK_ADAPTER)).toBeInstanceOf(StubBotCheckAdapter);
  });
});
