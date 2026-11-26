import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The run's pace of code requests (D-189 §8, review fix C6): Playwright starts a new worker after a failed
 * test, and the pace must not start again from nothing there, or one failure would spend the API's 10 a
 * minute and fail every test after it with a 429. The count lives in the run's file, made by globalSetup.
 */

const FILE_ENV = "HOTEL_FORM_E2E_CODE_PACE_FILE";

let folder = "";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(Date.parse("2026-11-26T10:00:00.000Z"));
  vi.resetModules();
  folder = mkdtempSync(path.join(tmpdir(), "ampm-code-pace-test-"));
  const file = path.join(folder, "pace.json");
  writeFileSync(file, "[]");
  vi.stubEnv(FILE_ENV, file);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  rmSync(folder, { recursive: true, force: true });
});

describe("the pace of code requests", () => {
  it("keeps its count across a worker started afresh, waiting while a minute's budget is spent", async () => {
    const first = await import("./code-pace");
    await first.reserveCodeRequests(9);
    vi.resetModules();
    const restarted = await import("./code-pace");
    let isReserved = false;
    const reserving = restarted.reserveCodeRequests(1).then(() => {
      isReserved = true;
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(isReserved).toBe(false);
    await vi.advanceTimersByTimeAsync(80_000);
    await reserving;
    expect(isReserved).toBe(true);
  });
});
