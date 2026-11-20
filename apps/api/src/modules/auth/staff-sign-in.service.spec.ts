import { SIGN_IN_ERRORS } from "@ampm/core";
import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../common/logger.service.js";
import { MemoryRateLimitStore } from "../../common/rate-limit/rate-limit.store.js";
import type { AuthTokenService } from "../../identity/auth-token.service.js";
import { signInKeysFor, type SignInKeys } from "../../identity/sign-in-keys.js";
import { generateTotpSecret, stepAt, totpAt } from "../../identity/totp.js";
import type { AuditService } from "../../policy/audit.service.js";
import type { SessionService } from "../../policy/session.service.js";
import type { CredentialRecord, CredentialsRepository } from "./credentials.repository.js";
import type { SignInGrants } from "./sign-in-grant.js";
import { StaffSignInService } from "./staff-sign-in.service.js";

const USER_ID = "8f6f2d1e-4c3b-4a2a-9e1d-0c5b7a6f3e21";
const NOW = new Date("2026-11-20T10:00:00Z");
const SECRET = generateTotpSecret();
const RIGHT = totpAt(SECRET, stepAt(NOW));
const NEAR = new Set([-1, 0, 1].map((offset) => totpAt(SECRET, stepAt(NOW) + offset)));
const WRONG = ["000000", "111111", "222222"].find((code) => !NEAR.has(code)) ?? "333333";

function keys(): SignInKeys {
  const found = signInKeysFor({
    IDENTITY_PROVIDER: "local",
    IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-long-enough-32",
  });
  if (!found) throw new Error("the local provider has sign-in keys");
  return found;
}

/** The challenge row as `auth_tokens` keeps it: five tries, each reserved before its code is compared. */
function challengeFake() {
  const row = { attempts: 0, used: false };
  const tokens = {
    findLiveSignInToken: vi.fn(async () =>
      row.used ? null : { id: "challenge-1", userId: USER_ID, attempts: row.attempts },
    ),
    claimAttempt: vi.fn(async () => {
      if (row.used || row.attempts >= 5) return false;
      row.attempts += 1;
      return true;
    }),
    burnIfSpent: vi.fn(async () => {
      if (row.attempts >= 5) row.used = true;
    }),
    markUsedIfLive: vi.fn(async () => {
      if (row.used) return false;
      row.used = true;
      return true;
    }),
  };
  return { row, tokens };
}

function harness(options: { locksAt?: number } = {}) {
  const box = keys().box;
  const user: CredentialRecord = {
    id: USER_ID,
    name: "Sana Staff",
    email: "sana@example.com",
    phone: null,
    userType: "staff",
    status: "active",
    identitySubject: `ampm:${USER_ID}`,
    passwordHash: "$argon2id$not-used-here",
    totpSecretEnc: box.seal(SECRET),
    totpPendingEnc: null,
    totpLastStep: null,
    failedCodes: 0,
  };
  let failures = 0;
  const credentials = {
    findById: vi.fn(async () => user),
    claimStep: vi.fn(async () => true),
    spendRecoveryCode: vi.fn(async () => false),
    recordCodeFailure: vi.fn(async () => ++failures === (options.locksAt ?? 20)),
    recordSuccess: vi.fn(async () => undefined),
  };
  const { row, tokens } = challengeFake();
  const grant = vi.fn(async () => ({
    accessToken: "access",
    user: { id: USER_ID, name: user.name, email: "sana@example.com" },
  }));
  const sessions = { revokeAllForUser: vi.fn(async () => undefined) };
  const audit = { record: vi.fn(async () => undefined) };
  const service = new StaffSignInService(
    keys(),
    credentials as unknown as CredentialsRepository,
    tokens as unknown as AuthTokenService,
    audit as unknown as AuditService,
    sessions as unknown as SessionService,
    { grant } as unknown as SignInGrants,
    new MemoryRateLimitStore(),
    { warn: vi.fn(), info: vi.fn() } as unknown as AppLogger,
  );
  return { service, row, tokens, credentials, grant, sessions, audit };
}

const tryCode = (service: StaffSignInService, code: string) =>
  service.verifyCode({ challenge: "raw-challenge", code }, NOW);

describe("StaffSignInService.verifyCode (D-142)", () => {
  it("reserves the try on the challenge before the code is compared", async () => {
    const { service, tokens, credentials, grant } = harness();
    await expect(tryCode(service, RIGHT)).resolves.toMatchObject({ accessToken: "access" });
    const [reserved] = tokens.claimAttempt.mock.invocationCallOrder;
    const [compared] = credentials.claimStep.mock.invocationCallOrder;
    expect(reserved).toBeLessThan(compared ?? 0);
    expect(tokens.markUsedIfLive).toHaveBeenCalledWith("challenge-1");
    expect(credentials.recordSuccess).toHaveBeenCalledWith(USER_ID, NOW);
    expect(grant).toHaveBeenCalledOnce();
  });

  it("refuses a code the challenge has no try left for, without comparing or counting it", async () => {
    const { service, row, credentials } = harness();
    row.attempts = 5; // the fifth try is still in flight, so the challenge is not burned yet
    await expect(tryCode(service, RIGHT)).rejects.toThrow(SIGN_IN_ERRORS.challengeExpired);
    expect(credentials.claimStep).not.toHaveBeenCalled();
    expect(credentials.recordCodeFailure).not.toHaveBeenCalled();
  });

  it("shares the five tries between codes sent at once, and counts only those toward the lock", async () => {
    const { service, row, credentials } = harness();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => tryCode(service, WRONG)),
    );
    const reasons = results.map((result) =>
      result.status === "rejected" ? String(result.reason) : "accepted",
    );
    expect(reasons.filter((r) => r.includes(SIGN_IN_ERRORS.invalidCode))).toHaveLength(5);
    expect(reasons.filter((r) => r.includes(SIGN_IN_ERRORS.challengeExpired))).toHaveLength(7);
    expect(row).toEqual({ attempts: 5, used: true });
    expect(credentials.recordCodeFailure).toHaveBeenCalledTimes(5);
  });

  it("burns the challenge on the fifth wrong code, so even the right one then starts again", async () => {
    const { service, row, tokens } = harness();
    for (let i = 0; i < 5; i += 1) {
      await expect(tryCode(service, WRONG)).rejects.toThrow(SIGN_IN_ERRORS.invalidCode);
    }
    expect(tokens.burnIfSpent).toHaveBeenCalledTimes(5);
    expect(row.used).toBe(true);
    await expect(tryCode(service, RIGHT)).rejects.toThrow(SIGN_IN_ERRORS.challengeExpired);
  });

  it("locks the account and ends its sessions when a wrong code reaches the ceiling", async () => {
    const { service, sessions, audit } = harness({ locksAt: 1 });
    await expect(tryCode(service, WRONG)).rejects.toThrow(SIGN_IN_ERRORS.invalidCode);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(USER_ID, "too_many_wrong_codes");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ after: { status: "locked", reason: "too_many_wrong_codes" } }),
    );
  });

  it("spends a try on a recovery code too", async () => {
    const { service, row, credentials } = harness();
    await expect(
      service.verifyCode({ challenge: "raw-challenge", recoveryCode: "ABCD-EFGH" }, NOW),
    ).rejects.toThrow(SIGN_IN_ERRORS.invalidCode);
    expect(row.attempts).toBe(1);
    expect(credentials.spendRecoveryCode).toHaveBeenCalledOnce();
  });
});
