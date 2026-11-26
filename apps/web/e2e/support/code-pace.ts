/*
 * The API lets one network ask for 10 codes a minute (`HOTEL_FORM_CODES`, a fixed window per network),
 * and every test asks from this machine's one network, through one worker. So the run paces its code
 * requests: each test reserves the codes it will ask for before asking, and waits while they would not fit
 * in a minute's budget. A reservation counts as made a little after it is granted, since its requests
 * follow within seconds, and the budget stays one under the limit.
 */

const WINDOW_MS = 60_000;
const BUDGET = 9;
/** How long after its reservation a test's code requests are counted as made, at the latest. */
const LEEWAY_MS = 15_000;

/** When each reserved code request counts as made, oldest first (one worker shares this module). */
const reserved: number[] = [];

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Waits until `count` more code requests fit in the minute's budget, then counts them.
 *
 * @example
 * await reserveCodeRequests(1); // then press "Send me a code"
 */
export async function reserveCodeRequests(count: number): Promise<void> {
  for (;;) {
    const now = Date.now();
    while (reserved.length > 0 && now - (reserved[0] ?? now) >= WINDOW_MS) reserved.shift();
    if (reserved.length + count <= BUDGET) {
      reserved.push(...Array.from({ length: count }, () => now + LEEWAY_MS));
      return;
    }
    await pause(WINDOW_MS - (now - (reserved[0] ?? now)) + 250);
  }
}
