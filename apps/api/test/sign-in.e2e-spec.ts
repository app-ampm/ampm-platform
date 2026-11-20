import { randomUUID } from "node:crypto";

import { SIGN_IN_ERRORS } from "@ampm/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { issueInviteToken } from "../src/identity/auth-token.service.js";
import {
  NOTIFICATION_ADAPTERS,
  type NotificationAdapters,
  type NotificationDelivery,
} from "../src/modules/admin/notification/notification.adapter.js";
import { stepAt, totpAt } from "../src/identity/totp.js";
import { startApi } from "./start-api.js";

/**
 * AMPM's own staff sign-in (D-142) end to end, under the local provider (whose sign-in keys derive from
 * its secret): activation sets the password and the authenticator, sign-in needs both, a recovery code
 * works once, wrong codes burn a challenge, ten failures pause the account, a reset link sets a new
 * password and signs every session out, an administrator's reset makes the next sign-in enrol again, and
 * sign-out ends the session. Every request carries its own forwarded address, so the per-IP limits of
 * these public routes never share a window across tests.
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

  const post = (path: string, body: object, bearer?: string) => {
    const call = request(app.getHttpServer())
      .post(path)
      .set("X-Forwarded-For", `10.42.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`)
      .send(body);
    return bearer ? call.set("authorization", `Bearer ${bearer}`) : call;
  };
  const me = (bearer: string) =>
    request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${bearer}`);
  /** The code a step away from now (activation used the current step; a code never repeats). */
  const codeFor = (secret: string, offset = 0) => totpAt(secret, stepAt(new Date()) + offset);

  /** An invited staff account and its raw invitation token, as the invite flow leaves them. */
  async function invite(): Promise<{ id: string; email: string; token: string }> {
    const email = `signin-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { userType: "staff", name: "Sana Staff", email, status: "invited" },
      select: { id: true },
    });
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, user.id));
    return { id: user.id, email, token };
  }

  /** Activates an invitation through the API; returns the authenticator secret and the grant. */
  async function activate(token: string) {
    const password = await post("/auth/activation/password", { token, password: PASSWORD });
    expect(password.status).toBe(200);
    const secret: string = password.body.data.enrolment.secret;
    const confirmed = await post("/auth/activation/confirm", { token, code: codeFor(secret) });
    expect(confirmed.status).toBe(200);
    return { secret, grant: confirmed.body.data };
  }

  async function signIn(email: string, password = PASSWORD) {
    return post("/auth/sign-in", { email, password });
  }

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
    // The invitation is spent: it cannot activate a second time.
    expect((await post("/auth/activation/preview", { token: invited.token })).status).toBe(401);
  });

  it("signs in with the password and then the authenticator code; never twice with one code", async () => {
    const invited = await invite();
    const { secret } = await activate(invited.token);
    const first = await signIn(invited.email);
    expect(first.body.data.kind).toBe("totp");
    const code = codeFor(secret, 1);
    const granted = await post("/auth/sign-in/code", {
      challenge: first.body.data.challenge,
      code,
    });
    expect(granted.status).toBe(200);
    expect((await me(granted.body.data.accessToken)).status).toBe(200);
    const again = await signIn(invited.email);
    const replay = await post("/auth/sign-in/code", { challenge: again.body.data.challenge, code });
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toBe(SIGN_IN_ERRORS.invalidCode);
  });

  it("answers a wrong password and an unknown email with the same message", async () => {
    const invited = await invite();
    await activate(invited.token);
    const wrong = await signIn(invited.email, "not the passphrase at all");
    const unknown = await signIn(`nobody-${randomUUID()}@example.com`);
    for (const response of [wrong, unknown]) {
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

  it("pauses the account after ten failures, even for the right password", async () => {
    const invited = await invite();
    await activate(invited.token);
    for (let i = 0; i < 10; i += 1) await signIn(invited.email, "a wrong guess, try again");
    const paused = await signIn(invited.email);
    expect(paused.status).toBe(401);
    expect(paused.body.error.message).toBe(SIGN_IN_ERRORS.invalidCredentials);
    await prisma.user.update({ where: { id: invited.id }, data: { lockedUntil: new Date(0) } });
    expect((await signIn(invited.email)).status).toBe(200);
  });

  it("resets a forgotten password through the emailed link and signs every session out", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    // Watch the email adapter: the link is cleared from the stored notification once it is sent.
    const sent: NotificationDelivery[] = [];
    const email = app.get<NotificationAdapters>(NOTIFICATION_ADAPTERS).for("email");
    const send = email.send.bind(email);
    const spy = vi.spyOn(email, "send").mockImplementation(async (delivery) => {
      sent.push(delivery);
      return send(delivery);
    });
    expect((await post("/auth/password/forgot", { email: invited.email })).body.data).toEqual({
      ok: true,
    });
    spy.mockRestore();
    const mail = sent.find((delivery) => delivery.templateKey === "auth.password_reset");
    const text = mail?.content.kind === "email" ? mail.content.text : "";
    const token = /reset-password\?token=([^\s]+)/.exec(text)?.[1] ?? "";
    expect(token).not.toBe("");
    const newPassword = "an entirely new passphrase";
    expect((await post("/auth/password/reset", { token, password: newPassword })).status).toBe(200);
    expect((await me(grant.accessToken)).status).toBe(401);
    expect((await post("/auth/password/reset", { token, password: newPassword })).status).toBe(401);
    expect((await signIn(invited.email)).status).toBe(401);
    expect((await signIn(invited.email, newPassword)).status).toBe(200);
  });

  it("makes the next sign-in add a new authenticator after an administrator resets it", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    const admin = await mint("local:admin");
    const reset = await post(`/admin/staff-users/${invited.id}/reset-authenticator`, {}, admin);
    expect(reset.status).toBe(200);
    expect((await me(grant.accessToken)).status).toBe(401);
    const started = await signIn(invited.email);
    expect(started.body.data.kind).toBe("enrol");
    const secret: string = started.body.data.enrolment.secret;
    const enrolled = await post("/auth/sign-in/enrol", {
      challenge: started.body.data.challenge,
      code: codeFor(secret),
    });
    expect(enrolled.status).toBe(200);
    expect(enrolled.body.data.recoveryCodes).toHaveLength(10);
  });

  it("ends the session on sign-out", async () => {
    const invited = await invite();
    const { grant } = await activate(invited.token);
    expect((await me(grant.accessToken)).status).toBe(200);
    expect((await post("/auth/sign-out", {}, grant.accessToken)).status).toBe(200);
    expect((await me(grant.accessToken)).status).toBe(401);
  });

  it("refuses to activate a client invitation with a password", async () => {
    const email = `client-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { userType: "client", name: "Cara Client", email, status: "invited" },
      select: { id: true },
    });
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, user.id));
    const refused = await post("/auth/activation/password", { token, password: PASSWORD });
    expect(refused.status).toBe(400);
  });
});
