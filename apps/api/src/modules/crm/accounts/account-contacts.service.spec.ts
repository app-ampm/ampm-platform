import { describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../../../common/logger.service.js";
import type { PrismaService } from "../../../db/prisma.service.js";
import type { Env } from "../../../env.js";
import type { AuthTokenService } from "../../../identity/auth-token.service.js";
import type { ClientUserService } from "../../../identity/client-user.service.js";
import type { IdentityProvisioner } from "../../../identity/identity.types.js";
import type { AuditService } from "../../../policy/audit.service.js";
import type { NotificationService } from "../../admin/notification/notification.service.js";
import { AccountContactsService } from "./account-contacts.service.js";
import { AccountInviteService } from "./account-invite.service.js";
import type { AccountContactRow, AccountRow, AccountsRepository } from "./accounts.repository.js";

const ACCOUNT: Pick<AccountRow, "id" | "isDemo" | "status"> = {
  id: "account-1",
  isDemo: false,
  status: "prospect",
};
const CONTACT: Pick<AccountContactRow, "id" | "accountId" | "userId"> = {
  id: "contact-1",
  accountId: "account-1",
  userId: "user-1",
};
const TX = { tx: true };

function harness(overrides: Partial<Env> = {}, status: string | null = "invited") {
  const env = {
    IDENTITY_PROVIDER: "local",
    NODE_ENV: "development",
    IDENTITY_LOCAL_SECRET: "change-me-local-secret",
    WEB_APP_URL: "https://app.example.test",
    ...overrides,
  } as unknown as Env;
  const findAccount = vi.fn(async () => ACCOUNT);
  const findContact = vi.fn(async () => CONTACT);
  const statusOf = vi.fn(async () => status);
  const issueInvite = vi.fn(async () => "change-me+invite");
  const record = vi.fn(async () => undefined);
  const $transaction = vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work(TX));
  const invites = new AccountInviteService(
    { statusOf } as unknown as ClientUserService,
    { issueInvite } as unknown as AuthTokenService,
    {} as unknown as NotificationService,
    {} as unknown as AppLogger,
    {} as unknown as IdentityProvisioner,
    env,
  );
  const service = new AccountContactsService(
    { findAccount, findContact } as unknown as AccountsRepository,
    { $transaction } as unknown as PrismaService,
    { record } as unknown as AuditService,
    invites,
  );
  return { service, findAccount, findContact, issueInvite, record, $transaction };
}

describe("AccountContactsService.inviteLink (test builds only)", () => {
  it("is a 404 outside a test build before any lookup, so production learns nothing", async () => {
    for (const closed of [{ NODE_ENV: "production" }, { IDENTITY_PROVIDER: "cognito" }] as const) {
      const { service, findAccount, findContact, $transaction } = harness(closed);
      await expect(service.inviteLink("account-1", "contact-1")).rejects.toMatchObject({
        code: "not_found",
      });
      expect(findAccount).not.toHaveBeenCalled();
      expect(findContact).not.toHaveBeenCalled();
      expect($transaction).not.toHaveBeenCalled();
    }
  });

  it("reissues an invited login's link in one transaction and audits it without the token", async () => {
    const { service, issueInvite, record } = harness();
    await expect(service.inviteLink("account-1", "contact-1")).resolves.toEqual({
      activationUrl: "https://app.example.test/activate?token=change-me%2Binvite",
    });
    expect(issueInvite).toHaveBeenCalledWith("user-1", TX);
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: "contact-1", after: { inviteLinkIssued: true } }),
      TX,
    );
  });

  it("refuses an activated or disabled login (409) and issues nothing", async () => {
    for (const status of ["active", "disabled"]) {
      const { service, issueInvite } = harness({}, status);
      await expect(service.inviteLink("account-1", "contact-1")).rejects.toMatchObject({
        code: "conflict",
      });
      expect(issueInvite).not.toHaveBeenCalled();
    }
  });
});
