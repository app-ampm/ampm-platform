import { randomUUID } from "node:crypto";

import { SIGN_IN_ERRORS } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { issueInviteToken } from "../src/identity/auth-token.service.js";
import { stepAt, totpAt } from "../src/identity/totp.js";
import {
  NOTIFICATION_ADAPTERS,
  type NotificationAdapters,
  type NotificationDelivery,
} from "../src/modules/admin/notification/notification.adapter.js";
import { startApi } from "./start-api.js";

/**
 * AMPM's own staff sign-in (D-142) end to end, under the local provider (whose sign-in keys derive from
 * its secret), including the fixes of its security review: activation sets the password and the
 * authenticator; sign-in needs both; a code never works twice; a recovery code works once; wrong codes
 * burn a challenge and twenty lock the account; passwords are throttled per email and client, so
 * nobody can lock another person out; the email match is exact; a reset link sets a new password and
 * signs every session out; an administrator's reset clears the sign-in and re-invites; sign-out ends the
 * session. Each request carries its own forwarded address unless a test pins one.
 */
describe("Staff sign-in (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let mint: (subject: string) => Promise<string>;
  let ipSeq = 0;
  const PASSWORD = "a long enough passphrase";

  beforeAll(async () => {
    ({ app, mint } = await startApi());
    app.set("trust proxy", true);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const freshIp = () => `10.42.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
  const post = (path: string, body: object, options: { bearer?: string; ip?: string } = {}) => {
    const call = request(app.getHttpServer())
      .post(path)
      .set("X-Forwarded-For", options.ip ?? freshIp())
      .send(body);
    return options.bearer ? call.set("authorization", `Bearer ${options.bearer}`) : call;
  };
  const me = (bearer: string) =>
    request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${bearer}`);
  /** The code a step away from now (activation used the current step; a code never repeats). */
  const codeFor = (secret: string, offset = 0) => totpAt(secret, stepAt(new Date()) + offset);

  /** Records every email the API sends until `stop`; the links in them are cleared once sent. */
  function watchEmails() {
    const sent: NotificationDelivery[] = [];
    const email = app.get<NotificationAdapters>(NOTIFICATION_ADAPTERS).for("email");
    const send = email.send.bind(email);
    const spy = vi.spyOn(email, "send").mockImplementation(async (delivery) => {
      sent.push(delivery);
      return send(delivery);
    });
    const linkIn = async (template: string, path: string): Promise<string> => {
      await vi.waitFor(() => expect(sent.some((d) => d.templateKey === template)).toBe(true));
      const mail = sent.find((d) => d.templateKey === template);
      const text = mail?.content.kind === "email" ? mail.content.text : "";
      return new RegExp(`${path}\\?token=([^\\s]+)`).exec(text)?.[1] ?? "";
    };
    return { linkIn, stop: () => spy.mockRestore() };
  }

  async function invite(email = `signin-${randomUUID()}@example.com`) {
    const user = await prisma.user.create({
      data: { userType: "staff", name: "Sana Staff", email, status: "invited" },
      select: { id: true },
    });
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, user.id));
    return { id: user.id, email, token };
  }

  async function activate(token: string, password = PASSWORD) {
    const set = await post("/auth/activation/password", { token, password });
    expect(set.status).toBe(200);
    const secret: string = set.body.data.enrolment.secret;
    const confirmed = await post("/auth/activation/confirm", { token, code: codeFor(secret) });
    expect(confirmed.status).toBe(200);
    return { secret, grant: confirmed.body.data };
  }

  const signIn = (email: string, password = PASSWORD, ip?: string) =>
    post("/auth/sign-in", { email, password }, ip ? { ip } : {});

  it("activates an invitation: password, authenticator, then an active account that is signed in", async () => {
    const invited = await invite();
    const preview = await post("/auth/activation/preview", { token: invited.token });
    expect(preview.body.data).toEqual({
      name: "Sana Staff",
      email: invited.email,
      userType: "staff",
    });
    const { grant } = await activate(invited.token);
    expect(grant.recoveryCodes).toHaveLength(10);
    expect((await me(grant.accessToken)).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(user).toMatchObject({ status: "active", identitySubject: `ampm:${invited.id}` });
    expect(user.passwordHash).toMatch(/^\$argon2id\$/);
    expect((await post("/auth/activation/preview", { token: invited.token })).status).toBe(401);
  });

  it("signs in with the password and then the authenticator code; never twice with one code", async () => {
    const invited = await invite();
    const { secret } = await activate(invited.token);
    const first = await signIn(invited.email);
    expect(first.body.data).toEqual({ kind: "totp", challenge: expect.any(String) });
    const code = codeFor(secret, 1);
    const granted = await post("/auth/sign-in/code", {
      challenge: first.body.data.challenge,
      code,
    });
    expect(granted.status).toBe(200);
    expect((await me(granted.body.data.accessToken)).status).toBe(200);
    const again = await signIn(invited.email);
    const replay = await post("/auth/sign-in/code", { challenge: again.body.data.challenge, code });
    expect(replay.body.error.message).toBe(SIGN_IN_ERRORS.invalidCode);
  });

  it("answers a wrong password, an unknown email and a look-alike email with the same message", async () => {
    const tag = randomUUID();
    const invited = await invite(`abxcd-${tag}@example.com`);
    await activate(invited.token);
    // `_` is a wildcard in ILIKE: the match must be exact, so this never reaches the real account.
    const lookAlike = await signIn(`ab_cd-${tag}@example.com`);
    const wrong = await signIn(invited.email, "not the passphrase at all");
    const unknown = await signIn(`nobody-${randomUUID()}@example.com`);
    for (const response of [lookAlike, wrong, unknown]) {
      expect(response.status).toBe(401);
      expect(response.body.error.message).toBe(SIGN_IN_ERRORS.invalidCredentials);
    }
  });

  it("accepts a recovery code once", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    const recoveryCode: string = grant.recoveryCodes[0];
    const first = await signIn(invited.email);
    const used = await post("/auth/sign-in/code", {
      challenge: first.body.data.challenge,
      recoveryCode,
    });
    expect(used.status).toBe(200);
    const second = await signIn(invited.email);
    const reused = await post("/auth/sign-in/code", {
      challenge: second.body.data.challenge,
      recoveryCode,
    });
    expect(reused.status).toBe(401);
  });

  it("burns a challenge after five wrong codes", async () => {
    const invited = await invite();
    const { secret } = await activate(invited.token);
    const { challenge } = (await signIn(invited.email)).body.data;
    for (let i = 0; i < 5; i += 1) {
      expect((await post("/auth/sign-in/code", { challenge, code: "000000" })).status).toBe(401);
    }
    const late = await post("/auth/sign-in/code", { challenge, code: codeFor(secret, 1) });
    expect(late.body.error.message).toBe(SIGN_IN_ERRORS.challengeExpired);
  });

  it("locks the account after twenty wrong codes in a row, for an administrator", async () => {
    const invited = await invite();
    await activate(invited.token);
    for (let round = 0; round < 4; round += 1) {
      const { challenge } = (await signIn(invited.email)).body.data;
      for (let i = 0; i < 5; i += 1)
        await post("/auth/sign-in/code", { challenge, code: "000000" });
    }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(user.status).toBe("locked");
    expect((await signIn(invited.email)).status).toBe(401);
  });

  it("throttles passwords per email and client, so one client cannot lock out another", async () => {
    const invited = await invite();
    await activate(invited.token);
    const attacker = freshIp();
    for (let i = 0; i < 10; i += 1)
      await signIn(invited.email, "a wrong guess, try again", attacker);
    // Refused from the attacker's network, even with the right password (the route limit may answer
    // first, 429; the per-email throttle answers 401 across minutes), while anyone else still gets in.
    expect([401, 429]).toContain((await signIn(invited.email, PASSWORD, attacker)).status);
    expect((await signIn(invited.email, PASSWORD, freshIp())).status).toBe(200);
  });

  it("resets a forgotten password through the emailed link and signs every session out", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    const emails = watchEmails();
    const answer = await post("/auth/password/forgot", { email: invited.email });
    expect(answer.body.data).toEqual({ ok: true });
    const token = await emails.linkIn("auth.password_reset", "reset-password");
    emails.stop();
    const newPassword = "an entirely new passphrase";
    expect((await post("/auth/password/reset", { token, password: newPassword })).status).toBe(200);
    expect((await me(grant.accessToken)).status).toBe(401);
    expect((await post("/auth/password/reset", { token, password: newPassword })).status).toBe(401);
    expect((await signIn(invited.email)).status).toBe(401);
    expect((await signIn(invited.email, newPassword)).status).toBe(200);
  });

  it("cancels a sign-in already past the password when the password is reset", async () => {
    const invited = await invite();
    const { secret } = await activate(invited.token);
    const { challenge } = (await signIn(invited.email)).body.data;
    const emails = watchEmails();
    await post("/auth/password/forgot", { email: invited.email });
    const token = await emails.linkIn("auth.password_reset", "reset-password");
    emails.stop();
    await post("/auth/password/reset", { token, password: "an entirely new passphrase" });
    const late = await post("/auth/sign-in/code", { challenge, code: codeFor(secret, 1) });
    expect(late.body.error.message).toBe(SIGN_IN_ERRORS.challengeExpired);
  });

  it("re-invites after an administrator resets the sign-in; the old password stops working", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    const emails = watchEmails();
    const admin = await mint("local:admin");
    const reset = await post(
      `/admin/staff-users/${invited.id}/reset-authenticator`,
      {},
      { bearer: admin },
    );
    expect(reset.status).toBe(200);
    expect(reset.body.data.status).toBe("invited");
    const token = await emails.linkIn("staff.invite", "activate");
    emails.stop();
    expect((await me(grant.accessToken)).status).toBe(401);
    expect((await signIn(invited.email)).status).toBe(401);
    const { grant: renewed } = await activate(token, "a brand new passphrase too");
    expect((await me(renewed.accessToken)).status).toBe(200);
  });

  it("ends the session on sign-out", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    expect((await me(grant.accessToken)).status).toBe(200);
    expect((await post("/auth/sign-out", {}, { bearer: grant.accessToken })).status).toBe(200);
    expect((await me(grant.accessToken)).status).toBe(401);
  });

  it("refuses to activate a client invitation with a password", async () => {
    const email = `client-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { userType: "client", name: "Cara Client", email, status: "invited" },
      select: { id: true },
    });
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, user.id));
    expect((await post("/auth/activation/password", { token, password: PASSWORD })).status).toBe(
      400,
    );
  });
});
