import { createHash, randomBytes } from "node:crypto";

import { hotelFormSessionToken } from "@ampm/core";

/*
 * A hotel form session's lifetime (D-189 §5; plan §4.3), pure. A correct code opens a session carried by
 * its challenge: an opaque `hfs_` token, of which only the SHA-256 is stored, sent as a Bearer header and
 * kept in the page's sessionStorage (no cookies, so no CSRF surface). It ends after 2 hours idle or 12 in
 * all, or when its person opens a fourth; `last_seen` is written at most once a minute.
 */

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

/** A form session token's prefix, which the secret scanners and the log redactor know (D-188 §6). */
export const HOTEL_FORM_SESSION_PREFIX = "hfs_";
/** A session ends after this long without a call... */
export const SESSION_IDLE_MS = 2 * HOUR_MS;
/** ...and this long after it started, however busy. */
export const SESSION_TOTAL_MS = 12 * HOUR_MS;
/** The live sessions a person may hold; opening another ends the oldest. */
export const MAX_SESSIONS_PER_PERSON = 3;
/** How stale `last_seen` may be before a call writes it again. */
export const TOUCH_EVERY_MS = MINUTE_MS;

/** A new session's token, and the hash that alone is stored. */
export interface SessionSecret {
  readonly token: string;
  readonly hash: string;
}

/** The SHA-256 of a session token, hex: what `session_token_hash` holds. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Mints a session's token.
 *
 * @example
 * const { token, hash } = mintSessionToken(); // store `hash`; answer `token` once
 */
export function mintSessionToken(): SessionSecret {
  const token = `${HOTEL_FORM_SESSION_PREFIX}${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashSessionToken(token) };
}

/** The session token of an `Authorization: Bearer hfs_…` header, or null for anything else. */
export function sessionTokenFrom(header: string | undefined): string | null {
  const [scheme, token, ...rest] = (header ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || rest.length > 0) return null;
  return hotelFormSessionToken.safeParse(token).success && token !== undefined ? token : null;
}

/** When a session started and was last seen (null: not since it started). */
export interface SessionTimes {
  readonly startedAt: Date;
  readonly lastSeenAt: Date | null;
}

/** Whether a session has expired at `now`: 2 hours idle, or 12 hours since it started. */
export function isSessionExpired(session: SessionTimes, now: Date): boolean {
  const seen = (session.lastSeenAt ?? session.startedAt).getTime();
  return (
    now.getTime() - seen >= SESSION_IDLE_MS ||
    now.getTime() - session.startedAt.getTime() >= SESSION_TOTAL_MS
  );
}

/**
 * The ids of a person's live sessions to end so they hold {@link MAX_SESSIONS_PER_PERSON} at most: the
 * oldest live ones beyond the newest three (the session just opened among them). Expired sessions are
 * neither counted nor ended.
 *
 * @example
 * await people.endSessions(sessionsToEnd(await people.openSessionsOf(personId, tx), now), now, tx);
 */
export function sessionsToEnd(
  sessions: readonly (SessionTimes & { readonly id: string })[],
  now: Date,
): string[] {
  return sessions
    .filter((session) => !isSessionExpired(session, now))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(MAX_SESSIONS_PER_PERSON)
    .map((session) => session.id);
}

/** Whether a call at `now` writes `last_seen` again: at most once a minute. */
export function needsTouch(lastSeenAt: Date, now: Date): boolean {
  return now.getTime() - lastSeenAt.getTime() >= TOUCH_EVERY_MS;
}
