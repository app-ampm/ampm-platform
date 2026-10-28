import type { Entitlements } from "@ampm/policy";
import { describe, expect, it } from "vitest";

import { PrismaService } from "../db/prisma.service.js";
import type { VerifiedIdentity } from "../identity/identity.types.js";
import { ConfigRepository, type ConfigRecord } from "../modules/admin/config/config.repository.js";
import { ConfigService } from "../modules/admin/config/config.service.js";
import { AuditService, type AuditInput } from "./audit.service.js";
import type { Principal } from "./principal.types.js";
import {
  SessionRepository,
  type NewSession,
  type OpenedSession,
  type SessionRecord,
} from "./session.repository.js";
import { SessionService } from "./session.service.js";

/** No rows, so ConfigService returns the registry baseline (staff 720, client/demo 43200). */
class FakeConfigRepository extends ConfigRepository {
  async findByKey(): Promise<ConfigRecord | null> {
    return null;
  }
}

/** Captures audit calls; `super(...)` is given a dummy because `record` is overridden (test-only). */
class FakeAudit extends AuditService {
  readonly records: AuditInput[] = [];
  constructor() {
    super(null as unknown as PrismaService);
  }
  override async record(input: AuditInput): Promise<void> {
    this.records.push(input);
  }
}

/** Models the real repository, including the unique `token_id` constraint (openSession is idempotent). */
class FakeSessionRepository extends SessionRepository {
  readonly byToken = new Map<string, SessionRecord>();
  private seq = 0;

  async findByTokenId(tokenId: string): Promise<SessionRecord | null> {
    return this.byToken.get(tokenId) ?? null;
  }
  async openSession(data: NewSession): Promise<OpenedSession> {
    const existing = this.byToken.get(data.tokenId);
    if (existing) return { created: false, session: existing };
    this.seq += 1;
    const session: SessionRecord = { id: `session-${this.seq}`, revokedAt: null, ...data };
    this.byToken.set(data.tokenId, session);
    return { created: true, session };
  }
  async touchLastSeen(id: string, at: Date): Promise<void> {
    for (const [key, row] of this.byToken) {
      if (row.id === id) this.byToken.set(key, { ...row, lastSeenAt: at });
    }
  }
  async revokeAllForUser(userId: string, _reason: string, at: Date): Promise<string[]> {
    const ids: string[] = [];
    for (const [key, row] of this.byToken) {
      if (row.userId === userId && !row.revokedAt) {
        this.byToken.set(key, { ...row, revokedAt: at });
        ids.push(row.id);
      }
    }
    return ids;
  }
}

/** A repository that always loses the create race: the token has no row to find, but openSession conflicts. */
class RaceLoserRepository extends SessionRepository {
  touched = false;
  constructor(private readonly winner: SessionRecord) {
    super();
  }
  async findByTokenId(): Promise<SessionRecord | null> {
    return null;
  }
  async openSession(): Promise<OpenedSession> {
    return { created: false, session: this.winner };
  }
  async touchLastSeen(): Promise<void> {
    this.touched = true;
  }
  async revokeAllForUser(): Promise<string[]> {
    return [];
  }
}

/** A repository whose session for the token belongs to a different user. */
class ForeignRepository extends SessionRepository {
  constructor(private readonly foreign: SessionRecord) {
    super();
  }
  async findByTokenId(): Promise<SessionRecord | null> {
    return this.foreign;
  }
  async openSession(): Promise<OpenedSession> {
    throw new Error("openSession should not be reached");
  }
  async touchLastSeen(): Promise<void> {}
  async revokeAllForUser(): Promise<string[]> {
    return [];
  }
}

function makeService() {
  const repository = new FakeSessionRepository();
  const audit = new FakeAudit();
  const service = new SessionService(
    repository,
    new ConfigService(new FakeConfigRepository()),
    audit,
  );
  return { service, repository, audit };
}

const identity = (tokenId: string): VerifiedIdentity => ({
  subject: "local:x",
  provider: "local",
  tokenId,
  email: null,
  phone: null,
});

const userBase = {
  userId: "user-1",
  name: "X",
  email: null,
  phone: null,
  status: "active" as const,
  lastLoginAt: null,
  memberships: [],
};
const staff: Principal = { ...userBase, type: "staff", roles: [] };
// touch never reads entitlements, so an empty object stands in for a client's/demo's (test-only).
const client: Principal = {
  ...userBase,
  type: "client",
  entitlements: {} as unknown as Entitlements,
};
const demo: Principal = { ...userBase, type: "demo", entitlements: {} as unknown as Entitlements };

const T0 = new Date("2026-10-28T00:00:00.000Z");
const session = (overrides: Partial<SessionRecord>): SessionRecord => ({
  id: "s-1",
  userId: "user-1",
  tokenId: "tok-1",
  idleTimeoutMinutes: 12 * 60,
  lastSeenAt: T0,
  revokedAt: null,
  ...overrides,
});

describe("SessionService", () => {
  it("opens a session on the first request, with the staff timeout, and audits it", async () => {
    const { service, repository, audit } = makeService();
    await service.touch(identity("tok-1"), staff, T0);
    const row = repository.byToken.get("tok-1");
    expect(row?.userId).toBe("user-1");
    expect(row?.idleTimeoutMinutes).toBe(12 * 60);
    expect(row?.lastSeenAt).toEqual(T0);
    expect(audit.records).toEqual([{ action: "create", entityType: "session", entityId: row?.id }]);
  });

  it("reuses the session on a later request and advances last-seen without a new audit", async () => {
    const { service, repository, audit } = makeService();
    await service.touch(identity("tok-1"), staff, T0);
    const later = new Date("2026-10-28T00:05:00.000Z");
    await service.touch(identity("tok-1"), staff, later);
    expect(repository.byToken.get("tok-1")?.lastSeenAt).toEqual(later);
    expect(audit.records).toHaveLength(1);
  });

  it("does not advance last-seen again within the throttle interval", async () => {
    const { service, repository } = makeService();
    await service.touch(identity("tok-1"), staff, T0);
    await service.touch(identity("tok-1"), staff, new Date("2026-10-28T00:00:30.000Z")); // 30s < 60s
    expect(repository.byToken.get("tok-1")?.lastSeenAt).toEqual(T0);
  });

  it("uses the winner's row and does not re-audit when it loses the create race", async () => {
    const audit = new FakeAudit();
    const repository = new RaceLoserRepository(session({ id: "s-win" }));
    const service = new SessionService(
      repository,
      new ConfigService(new FakeConfigRepository()),
      audit,
    );
    await service.touch(identity("tok-1"), staff, new Date("2026-10-28T00:00:10.000Z"));
    expect(audit.records).toHaveLength(0);
  });

  it("refuses a token whose session belongs to another user (fail closed)", async () => {
    const repository = new ForeignRepository(
      session({ id: "s-other", userId: "user-2", tokenId: "tok-x" }),
    );
    const service = new SessionService(
      repository,
      new ConfigService(new FakeConfigRepository()),
      new FakeAudit(),
    );
    await expect(service.touch(identity("tok-x"), staff, T0)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("refuses a session left idle past its timeout", async () => {
    const { service } = makeService();
    await service.touch(identity("tok-1"), staff, T0);
    const past = new Date("2026-10-28T13:00:00.000Z"); // 13h > the 12h staff window
    await expect(service.touch(identity("tok-1"), staff, past)).rejects.toMatchObject({
      code: "unauthenticated",
    });
  });

  it("revokes every live session of a user, audits it, and refuses the token afterwards", async () => {
    const { service, repository, audit } = makeService();
    await service.touch(identity("tok-1"), staff, T0);
    await service.revokeAllForUser(
      "user-1",
      "membership_changed",
      new Date("2026-10-28T00:01:00.000Z"),
    );
    expect(repository.byToken.get("tok-1")?.revokedAt).not.toBeNull();
    expect(audit.records.some((r) => r.action === "update" && r.entityType === "session")).toBe(
      true,
    );
    await expect(
      service.touch(identity("tok-1"), staff, new Date("2026-10-28T00:02:00.000Z")),
    ).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("gives a client and a demo the longer idle timeout", async () => {
    const { service, repository } = makeService();
    await service.touch(identity("tok-c"), client, T0);
    await service.touch(identity("tok-d"), demo, T0);
    expect(repository.byToken.get("tok-c")?.idleTimeoutMinutes).toBe(30 * 24 * 60);
    expect(repository.byToken.get("tok-d")?.idleTimeoutMinutes).toBe(30 * 24 * 60);
  });

  it("opens no session for the system principal", async () => {
    const { service, repository } = makeService();
    await service.touch(identity("tok-s"), { type: "system", name: "system" }, T0);
    expect(repository.byToken.size).toBe(0);
  });
});
