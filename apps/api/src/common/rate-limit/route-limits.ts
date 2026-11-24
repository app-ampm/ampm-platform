import type { RateLimitOptions } from "./rate-limit.decorator.js";

const MINUTE = 60_000;

/*
 * The limits several controllers share (D-149): one bucket each, so a caller's requests of one kind
 * count together wherever they land.
 */

/**
 * What a signed-in client or demo prospect reads: generous, since one screen makes several calls, and
 * failing open, so a broken limiter never stops anyone browsing.
 *
 * @example
 * \@RateLimit(CLIENT_READS) // on a client controller: every route there without a limit of its own
 * export class ProposalsClientController {}
 */
export const CLIENT_READS: RateLimitOptions = {
  name: "client.reads",
  limit: 300,
  perIpLimit: 1200,
  windowMs: MINUTE,
  failClosed: false,
};

/**
 * A client's everyday writes to their own records (a saved hotel and its note, an enquiry note, a
 * decision on a proposal, feedback): cheap rows with no notification fan-out, so they fail open too.
 */
export const CLIENT_WRITES: RateLimitOptions = {
  name: "client.writes",
  limit: 60,
  perIpLimit: 300,
  windowMs: MINUTE,
  failClosed: false,
};

/**
 * File uploads (gallery media, a signed contract, a signed agreement copy, a reference's consent, a hotel
 * spreadsheet import): each reads up to 25 MiB (the import 5 MiB, D-181), is checked and stored or
 * applied, so they share one bucket per member of staff and fail closed. A route that reads a file takes
 * it through @UploadRoute, with an upload slot (D-187).
 */
export const UPLOADS: RateLimitOptions = {
  name: "uploads",
  limit: 30,
  perIpLimit: 90,
  windowMs: MINUTE,
  failClosed: true,
};
