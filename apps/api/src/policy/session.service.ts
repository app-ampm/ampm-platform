import { Injectable } from "@nestjs/common";
import { errors } from "@ampm/core";

import type { VerifiedIdentity } from "../identity/identity.types.js";
import { ConfigService } from "../modules/admin/config/config.service.js";
import { AuditService } from "./audit.service.js";
import type { Principal } from "./principal.types.js";
import { SessionRepository, type SessionRecord } from "./session.repository.js";

const MINUTE_MS = 60_000;
/** last_seen_at is advanced at most this often: idle timeouts are minutes-to-days, so coarse is fine. */
const BUMP_INTERVAL_MS = 60_000;

/**
 * Step 3b of the pipeline (security.md): the server-side session behind an access token. The token
 * proves identity; this keeps a `sessions` row per token (D-033) that the API expires on idle
 * (staff 12 h / client 30 d, from configurations) and revokes on sign-out or a role or membership
 * change. Create and revoke are audited; an expired, revoked, or wrong-owner session is
 * `unauthenticated`. The system principal has no session. Opening is idempotent, so a burst of
 * concurrent first requests on one fresh token is safe.
 *
 * @example
 * await this.sessions.touch(verified, principal, new Date());
 * await this.sessions.revokeAllForUser(userId, "membership_changed");
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly repository: SessionRepository,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /** Loads or opens the session for a verified token and advances its activity; throws if it is dead. */
  async touch(identity: VerifiedIdentity, principal: Principal, now: Date): Promise<void> {
    if (principal.type === "system") return;
    const existing = await this.repository.findByTokenId(identity.tokenId);
    if (existing) return this.useExisting(existing, principal, now);
    const { created, session } = await this.repository.openSession({
      userId: principal.userId,
      tokenId: identity.tokenId,
      idleTimeoutMinutes: await this.idleTimeoutFor(principal.type),
      lastSeenAt: now,
    });
    if (!created) return this.useExisting(session, principal, now);
    await this.audit.record({ action: "create", entityType: "session", entityId: session.id });
  }

  /** Ends every live session of a user (a role or membership change, or sign-out). */
  async revokeAllForUser(userId: string, reason: string, now: Date = new Date()): Promise<void> {
    const revoked = await this.repository.revokeAllForUser(userId, reason, now);
    for (const id of revoked) {
      await this.audit.record({
        action: "update",
        entityType: "session",
        entityId: id,
        after: { revokedReason: reason },
      });
    }
  }

  /** The checks on a session that already exists: it must be the caller's, live, and not idle. */
  private async useExisting(
    session: SessionRecord,
    principal: Principal,
    now: Date,
  ): Promise<void> {
    if (principal.type === "system") return;
    // Fail closed if the token's session belongs to someone else (defence against any jti collision).
    if (session.userId !== principal.userId)
      throw errors.unauthenticated("This session is not yours");
    if (session.revokedAt) throw errors.unauthenticated("This session has ended");
    if (this.isIdle(session, now)) throw errors.unauthenticated("This session has expired");
    if (now.getTime() - session.lastSeenAt.getTime() >= BUMP_INTERVAL_MS) {
      await this.repository.touchLastSeen(session.id, now);
    }
  }

  private isIdle(session: SessionRecord, now: Date): boolean {
    return now.getTime() - session.lastSeenAt.getTime() > session.idleTimeoutMinutes * MINUTE_MS;
  }

  private async idleTimeoutFor(type: "staff" | "client" | "demo"): Promise<number> {
    const timeouts = await this.config.get("session.idle_timeouts");
    if (type === "staff") return timeouts.staffMinutes;
    if (type === "demo") return timeouts.demoMinutes;
    return timeouts.clientMinutes;
  }
}
