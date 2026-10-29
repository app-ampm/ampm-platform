/** Every e2e run uses the local identity provider against the test database. */
import { loadDotEnv } from "./dotenv.js";

loadDotEnv();
process.env["NODE_ENV"] = "test";
// The rate-limit e2e asserts the in-memory limiter; a REDIS_URL in a developer's .env must not swap in
// the Redis store (an unreachable one fails open and breaks the assertion; a reachable one is mutated).
delete process.env["REDIS_URL"];
process.env["IDENTITY_PROVIDER"] = "local";
process.env["IDENTITY_LOCAL_SECRET"] ??= "e2e-local-secret-that-is-long-enough-for-hs256";
process.env["LOG_LEVEL"] = "error";
const testUrl = process.env["DATABASE_URL_TEST"];
if (!testUrl)
  throw new Error("DATABASE_URL_TEST is required for the e2e tests (a disposable PostgreSQL)");
process.env["DATABASE_URL"] = testUrl;
