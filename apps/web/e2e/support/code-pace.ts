import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/*
 * The API lets one network ask for 10 codes a minute (`HOTEL_FORM_CODES`, a fixed window per network),
 * and every test asks from this machine's one network, through one worker. So the run paces its code
 * requests: each test reserves the codes it will ask for before asking, and waits while they would not fit
 * in a minute's budget. A reservation counts as made a little after it is granted, since its requests
 * follow within seconds, and the budget stays one under the limit. The reservations live in a small file of
 * the run's (globalSetup makes it under the OS temp directory, globalTeardown removes it), so a worker that
 * Playwright starts afresh after a failed test keeps the count instead of spending the window again.
 */

const WINDOW_MS = 60_000;
const BUDGET = 9;
/** How long after its reservation a test's code requests are counted as made, at the latest. */
const LEEWAY_MS = 15_000;

/** The environment variable that names the run's reservations file for every worker. */
export const CODE_PACE_FILE_ENV = "HOTEL_FORM_E2E_CODE_PACE_FILE";

/** Where this worker keeps the reservations without a run's file (a spec run on its own). */
const inMemory: number[] = [];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Makes the run's reservations file, empty, under the OS temp directory; answers its path, which
 * globalSetup hands every worker through {@link CODE_PACE_FILE_ENV}.
 */
export function startCodePace(): string {
  const file = path.join(tmpdir(), `ampm-hotel-form-e2e-pace-${process.pid}-${Date.now()}.json`);
  writeFileSync(file, "[]");
  return file;
}

/** Removes the run's reservations file, if it is there. */
export function endCodePace(file: string | undefined): void {
  if (file !== undefined) rmSync(file, { force: true });
}

/** When each reserved code request counts as made, as the run has kept them. */
function reservedSoFar(): number[] {
  const file = process.env[CODE_PACE_FILE_ENV];
  if (file === undefined) return [...inMemory];
  const kept: unknown = JSON.parse(readFileSync(file, "utf8"));
  return Array.isArray(kept) ? kept.filter((at): at is number => typeof at === "number") : [];
}

function keepReserved(reserved: readonly number[]): void {
  const file = process.env[CODE_PACE_FILE_ENV];
  if (file === undefined) inMemory.splice(0, inMemory.length, ...reserved);
  else writeFileSync(file, JSON.stringify(reserved));
}

/**
 * Waits until `count` more code requests fit in the minute's budget, then counts them.
 *
 * @example
 * await reserveCodeRequests(1); // then press "Send me a code"
 */
export async function reserveCodeRequests(count: number): Promise<void> {
  for (;;) {
    const now = Date.now();
    const reserved = reservedSoFar()
      .filter((at) => now - at < WINDOW_MS)
      .sort((a, b) => a - b);
    if (reserved.length + count <= BUDGET) {
      keepReserved([...reserved, ...Array.from({ length: count }, () => now + LEEWAY_MS)]);
      return;
    }
    keepReserved(reserved);
    await pause(WINDOW_MS - (now - (reserved[0] ?? now)) + 250);
  }
}
