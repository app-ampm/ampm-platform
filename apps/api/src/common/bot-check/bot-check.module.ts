import { Module } from "@nestjs/common";

import { ENV, type Env } from "../../env.js";
import { AppLogger } from "../logger.service.js";
import {
  BOT_CHECK_ADAPTER,
  SiteverifyBotCheckAdapter,
  StubBotCheckAdapter,
  type BotCheckAdapter,
} from "./bot-check.adapter.js";

/** The settings that choose the bot check. */
type BotCheckEnv = Pick<Env, "BOT_CHECK_PROVIDER" | "BOT_CHECK_URL" | "BOT_CHECK_SECRET">;

/**
 * The configured bot check: siteverify when its provider, URL and secret are set, the stub otherwise
 * (env.ts refuses the stub in production, and siteverify without its URL or secret, C1).
 *
 * @example
 * botCheckAdapterFor(env, logger); // StubBotCheckAdapter in development
 */
export function botCheckAdapterFor(
  env: BotCheckEnv,
  logger: ConstructorParameters<typeof SiteverifyBotCheckAdapter>[2],
): BotCheckAdapter {
  return env.BOT_CHECK_PROVIDER === "siteverify" && env.BOT_CHECK_URL && env.BOT_CHECK_SECRET
    ? new SiteverifyBotCheckAdapter(env.BOT_CHECK_URL, env.BOT_CHECK_SECRET, logger)
    : new StubBotCheckAdapter();
}

/**
 * The public forms' bot check for any module that imports it (D-189 §7): the website enquiry (CrmModule)
 * and the hotel form. ENV and AppLogger come from the global PlatformModule.
 *
 * @example
 * \@Module({ imports: [BotCheckModule] }) // then @Inject(BOT_CHECK_ADAPTER) botCheck: BotCheckAdapter
 */
@Module({
  providers: [
    {
      provide: BOT_CHECK_ADAPTER,
      useFactory: (env: Env, logger: AppLogger): BotCheckAdapter => botCheckAdapterFor(env, logger),
      inject: [ENV, AppLogger],
    },
  ],
  exports: [BOT_CHECK_ADAPTER],
})
export class BotCheckModule {}
