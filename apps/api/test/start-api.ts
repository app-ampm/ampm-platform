import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";

import { AppModule } from "../src/app.module.js";
import { configureHttp, HTTP_APP_OPTIONS } from "../src/http.setup.js";
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

/** Changes the application before it is built: a provider swapped for a test double. */
export type CustomiseApi = (builder: TestingModuleBuilder) => TestingModuleBuilder;

/**
 * Builds the whole application with the server's HTTP settings (configureHttp), so an e2e suite
 * exercises what runs, against the test database the global setup migrated and seeded. `customise`
 * may swap a provider first (the hotel form's suites swap the limiter's store and, for SMS mode, the
 * environment and the SMS adapter).
 *
 * @example
 * const { app, mint } = await startApi();
 * const bearer = `Bearer ${await mint("local:pm")}`;
 * await request(app.getHttpServer()).get("/me").set("authorization", bearer);
 */
export async function startApi(customise: CustomiseApi = (builder) => builder): Promise<TestApi> {
  const moduleRef = await customise(Test.createTestingModule({ imports: [AppModule] })).compile();
  // The options main.ts uses: the webhook's raw-body signature check (8.3) and the JSON parser only.
  const app = moduleRef.createNestApplication<NestExpressApplication>(HTTP_APP_OPTIONS);
  configureHttp(app);
  await app.init();
  const adapter = new LocalIdentityAdapter(process.env["IDENTITY_LOCAL_SECRET"] ?? "");
  return { app, mint: (subject) => adapter.mint(subject) };
}
