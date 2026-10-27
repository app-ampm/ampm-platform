import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { configureHttp } from "../src/http.setup.js";
import { LocalIdentityAdapter } from "../src/identity/local.adapter.js";

/**
 * The API as main.ts serves it, and tokens of the local provider for the seeded accounts.
 *
 * @example
 * let api: TestApi;
 * beforeAll(async () => (api = await startApi()));
 */
export interface TestApi {
  readonly app: NestExpressApplication;
  /** An access token for a local identity subject (prisma/seed.ts), e.g. "local:pm". */
  readonly mint: (subject: string) => Promise<string>;
}

/**
 * Builds the whole application with the server's HTTP settings (configureHttp), so an e2e suite
 * exercises what runs, against the test database the global setup migrated and seeded.
 *
 * @example
 * const { app, mint } = await startApi();
 * const bearer = `Bearer ${await mint("local:pm")}`;
 * await request(app.getHttpServer()).get("/me").set("authorization", bearer);
 */
export async function startApi(): Promise<TestApi> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureHttp(app);
  await app.init();
  const adapter = new LocalIdentityAdapter(process.env["IDENTITY_LOCAL_SECRET"] ?? "");
  return { app, mint: (subject) => adapter.mint(subject) };
}
