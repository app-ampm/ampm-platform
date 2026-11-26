import { hotelFormSessionError } from "@ampm/core";

import type { Prisma } from "../../../generated/prisma/client.js";
import type { HotelFormSessionsRepository } from "./hotel-form-sessions.repository.js";
import type { FormSession } from "./hotel-form-sessions.service.js";

/**
 * The session a call holds, checked again once the call holds its request's lock (D-190 §3, review fix
 * D1). The guard checked it before the handler ran, without the lock, so a withdrawal of every consent in
 * another of the person's sessions may have committed since: it ends their sessions and takes back their
 * privacy notice consent under the same lock, and nothing more may be written as them. A submit, a
 * section's save and a correction call this right after taking the lock, before they write anything; a
 * session that is over is the 401 `session_ended` the guard answers on the next call.
 *
 * @example
 * const request = inForm(await submissions.lock(session.requestId, tx));
 * await requireOpenSession(sessions, session, tx);
 */
export async function requireOpenSession(
  sessions: HotelFormSessionsRepository,
  session: FormSession,
  tx: Prisma.TransactionClient,
): Promise<void> {
  if (!(await sessions.isOpen(session.challengeId, session.personId, tx))) {
    throw hotelFormSessionError("session_ended");
  }
}
