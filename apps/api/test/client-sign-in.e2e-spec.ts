import { randomInt, randomUUID } from "node:crypto";

import { ACTIVATION_ERRORS, SIGN_IN_ERRORS } from "@ampm/core";
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
import { startApi } from "./start-api.js";

// This suite runs with the temporary on-screen code on (D-147), so it can also check the code the SMS
// carries matches the one shown. Each e2e file runs in its own worker, so no other suite sees it.
process.env["CLIENT_OTP_SCREEN_ECHO"] = "true";

/**
 * Client sign-in and activation by a one-time code to the mobile on file (D-147), end to end: the code
 * goes out on the SMS channel (and, here, back to the screen); it works once; five wrong tries burn it;
 * a number with no client gets the same answer and no SMS; asking again within 30 seconds is refused;
 * staff accounts never sign in this way; an invited client activates with a code to the mobile on file;
 * guesses sent at once share a code's five tries; no activation lands on a mobile another client has.
 */
describe("Client sign-in by mobile code (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let ipSeq = 0;

  beforeAll(async () => {
    ({ app } = await startApi());
    app.set("trust proxy", true);
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const freshIp = () => `10.43.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
  const post = (path: string, body: object) =>
    request(app.getHttpServer()).post(path).set("X-Forwarded-For", freshIp()).send(body);
  const me = (bearer: string) =>
    request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${bearer}`);
  const freshPhone = () => `+919${String(randomInt(0, 1_000_000_000)).padStart(9, "0")}`;

  /** Records every SMS the API hands the adapter until `stop`. */
  function watchSms() {
    const sent: NotificationDelivery[] = [];
    const sms = app.get<NotificationAdapters>(NOTIFICATION_ADAPTERS).for("sms");
    const send = sms.send.bind(sms);
    const spy = vi.spyOn(sms, "send").mockImplementation(async (delivery) => {
      if (delivery.channel === "sms") sent.push(delivery);
      return send(delivery);
    });
    const to = async (phone: string): Promise<NotificationDelivery> => {
      await vi.waitFor(() => expect(sent.some((d) => d.address === phone)).toBe(true));
      const found = sent.find((d) => d.address === phone);
      if (!found) throw new Error("no SMS");
      return found;
    };
    return { sent, to, stop: () => spy.mockRestore() };
  }

  async function client(status: "active" | "invited", phone: string | null = freshPhone()) {
    const user = await prisma.user.create({
      data: {
        userType: "client",
        status,
        name: "Cara Client",
        email: `client-${randomUUID()}@example.com`,
        phone,
        identitySubject: status === "active" ? `local:otp-${randomUUID()}` : null,
      },
      select: { id: true },
    });
    return { id: user.id, phone };
  }

  it("signs an active client in with the code the SMS carries, also shown on screen", async () => {
    const { phone } = await client("active");
    const sms = watchSms();
    const asked = await post("/auth/client/code", { phone });
    expect(asked.status).toBe(200);
    expect(asked.body.data).toEqual({
      expiresInSeconds: 300,
      resendAfterSeconds: 30,
      screenCode: expect.stringMatching(/^\d{6}$/),
    });
    const code: string = asked.body.data.screenCode;
    const delivery = await sms.to(phone ?? "");
    sms.stop();
    expect(delivery.templateKey).toBe("auth.client_otp");
    expect(delivery.variables).toEqual({ code });
    expect(delivery.content).toEqual({ kind: "sms", text: expect.stringContaining(code) });
    const granted = await post("/auth/client/sign-in", { phone, code });
    expect(granted.status).toBe(200);
    expect((await me(granted.body.data.accessToken)).status).toBe(200);
    // A code works once.
    const again = await post("/auth/client/sign-in", { phone, code });
    expect(again.body.error.message).toBe(SIGN_IN_ERRORS.invalidClientCode);
  });

  it("accepts the ten digits without +91, as the form sends them", async () => {
    const { phone } = await client("active");
    const local = (phone ?? "").slice(3);
    const asked = await post("/auth/client/code", { phone: local });
    const granted = await post("/auth/client/sign-in", {
      phone: local,
      code: asked.body.data.screenCode,
    });
    expect(granted.status).toBe(200);
  });

  it("answers the same for a number with no client, without a code, and texts nobody", async () => {
    const phone = freshPhone();
    const sms = watchSms();
    const asked = await post("/auth/client/code", { phone });
    sms.stop();
    expect(asked.status).toBe(200);
    expect(asked.body.data).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 30 });
    expect(sms.sent.some((d) => d.address === phone)).toBe(false);
    const tried = await post("/auth/client/sign-in", { phone, code: "123456" });
    expect(tried.status).toBe(401);
    expect(tried.body.error.message).toBe(SIGN_IN_ERRORS.invalidClientCode);
  });

  it("burns a code after five wrong tries", async () => {
    const { phone } = await client("active");
    const { screenCode } = (await post("/auth/client/code", { phone })).body.data;
    const wrong = screenCode === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i += 1) {
      const tried = await post("/auth/client/sign-in", { phone, code: wrong });
      expect(tried.body.error.message).toBe(SIGN_IN_ERRORS.invalidClientCode);
    }
    const late = await post("/auth/client/sign-in", { phone, code: screenCode });
    expect(late.body.error.message).toBe(SIGN_IN_ERRORS.invalidClientCode);
  });

  it("shares a code's five tries between guesses sent at once", async () => {
    const { id, phone } = await client("active");
    const { screenCode } = (await post("/auth/client/code", { phone })).body.data;
    const wrong = screenCode === "000000" ? "111111" : "000000";
    const guesses = await Promise.all(
      Array.from({ length: 12 }, () => post("/auth/client/sign-in", { phone, code: wrong })),
    );
    expect(guesses.every((g) => g.status === 401)).toBe(true);
    const row = await prisma.authToken.findFirstOrThrow({
      where: { userId: id, purpose: "otp" },
      orderBy: { createdAt: "desc" },
    });
    expect(row.attempts).toBe(5);
    expect(row.usedAt).not.toBeNull();
    const late = await post("/auth/client/sign-in", { phone, code: screenCode });
    expect(late.body.error.message).toBe(SIGN_IN_ERRORS.invalidClientCode);
  });

  it("refuses another code for the same number within 30 seconds, known or not", async () => {
    const { phone } = await client("active");
    expect((await post("/auth/client/code", { phone })).status).toBe(200);
    const again = await post("/auth/client/code", { phone });
    expect(again.status).toBe(429);
    expect(again.body.error.message).toBe(SIGN_IN_ERRORS.clientCodeTooSoon);
    const unknown = freshPhone();
    await post("/auth/client/code", { phone: unknown });
    expect((await post("/auth/client/code", { phone: unknown })).status).toBe(429);
  });

  it("never signs a staff account in by mobile code", async () => {
    const phone = freshPhone();
    await prisma.user.create({
      data: {
        userType: "staff",
        status: "active",
        name: "Sana Staff",
        email: `s-${randomUUID()}@example.com`,
        phone,
      },
    });
    const asked = await post("/auth/client/code", { phone });
    expect(asked.body.data).toEqual({ expiresInSeconds: 300, resendAfterSeconds: 30 });
  });

  it("activates an invited client with a code to the mobile on file, then signs them in", async () => {
    const invited = await client("invited");
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, invited.id));
    const preview = await post("/auth/activation/preview", { token });
    expect(preview.body.data.userType).toBe("client");
    const sent = await post("/auth/activation/client/code", { token });
    expect(sent.status).toBe(200);
    expect(sent.body.data.maskedPhone).toBe(`+91 ••••• •${(invited.phone ?? "").slice(-4)}`);
    const confirmed = await post("/auth/activation/client/confirm", {
      token,
      code: sent.body.data.screenCode,
    });
    expect(confirmed.status).toBe(200);
    expect((await me(confirmed.body.data.accessToken)).status).toBe(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: invited.id } });
    expect(user).toMatchObject({ status: "active", identitySubject: `ampm:${invited.id}` });
    const reused = await post("/auth/activation/client/code", { token });
    expect(reused.status).toBe(401);
    expect(reused.body.error.message).toBe(ACTIVATION_ERRORS.invalidInvite);
  });

  it("refuses to activate onto a mobile another active client already has", async () => {
    const taken = await client("active");
    const invited = await client("invited", taken.phone);
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, invited.id));
    const sent = await post("/auth/activation/client/code", { token });
    expect(sent.status).toBe(409);
    expect(sent.body.error.message).toBe(SIGN_IN_ERRORS.mobileInUse);
  });

  it("tells an invited client with no mobile on file to ask AMPM for one", async () => {
    const invited = await client("invited", null);
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, invited.id));
    const sent = await post("/auth/activation/client/code", { token });
    expect(sent.status).toBe(409);
    expect(sent.body.error.message).toBe(SIGN_IN_ERRORS.noMobileOnFile);
  });

  it("keeps staff invitations on the password and authenticator activation", async () => {
    const user = await prisma.user.create({
      data: {
        userType: "staff",
        status: "invited",
        name: "Sana Staff",
        email: `s-${randomUUID()}@example.com`,
        phone: freshPhone(),
      },
      select: { id: true },
    });
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, user.id));
    expect((await post("/auth/activation/client/code", { token })).status).toBe(400);
  });
});
