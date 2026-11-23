import { randomBytes, randomUUID } from "node:crypto";

import type { NestExpressApplication } from "@nestjs/platform-express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { PrismaService } from "../src/db/prisma.service.js";
import { issueInviteToken } from "../src/identity/auth-token.service.js";
import { SIGN_IN_KEYS, type SignInKeys } from "../src/identity/sign-in-keys.js";
import { stepAt, totpAt } from "../src/identity/totp.js";
import {
  NOTIFICATION_ADAPTERS,
  type NotificationAdapters,
  type NotificationDelivery,
} from "../src/modules/admin/notification/notification.adapter.js";
import { startApi } from "./start-api.js";

/** The env this suite swaps to AMPM's own sign-in for its run, restored afterwards. */
const SWAPPED = ["IDENTITY_PROVIDER", "AUTH_TOKEN_SECRET", "AUTH_ENCRYPTION_KEY"] as const;

/**
 * `POST /auth/activate` under AMPM's own sign-in (D-142), the provider production runs. The route is the
 * development provider's "link on activate" (D-041); under `ampm` a staff member activates through the
 * password and authenticator routes instead. The case it closes (D-162): an administrator resets a staff
 * member's sign-in (account back to `invited`, every session revoked, a new invitation emailed), and the
 * holder of that member's earlier access token, still unexpired and still signature-valid, presents it
 * with the new invitation. `@Public()` skips the session check, so before the gate the API activated the
 * account with no password and no authenticator. Outside a dev build the route must not exist.
 */
describe("Activation link route under the ampm provider (e2e)", () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let keys: SignInKeys;
  let ipSeq = 0;
  const saved = new Map<string, string | undefined>();
  const PASSWORD = "a long enough passphrase";

  beforeAll(async () => {
    for (const key of SWAPPED) saved.set(key, process.env[key]);
    process.env["IDENTITY_PROVIDER"] = "ampm";
    // Generated per run, so no secret-like literal sits in the repository.
    process.env["AUTH_TOKEN_SECRET"] = randomBytes(32).toString("hex");
    process.env["AUTH_ENCRYPTION_KEY"] = randomBytes(32).toString("base64");
    ({ app } = await startApi());
    app.set("trust proxy", true);
    prisma = app.get(PrismaService);
    keys = app.get<SignInKeys>(SIGN_IN_KEYS);
  });

  afterAll(async () => {
    await app.close();
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const freshIp = () => `10.43.${Math.floor(++ipSeq / 250)}.${ipSeq % 250}`;
  const post = (path: string, body: object, bearer?: string) => {
    const call = request(app.getHttpServer())
      .post(path)
      .set("X-Forwarded-For", freshIp())
      .send(body);
    return bearer ? call.set("authorization", `Bearer ${bearer}`) : call;
  };
  const me = (bearer: string) =>
    request(app.getHttpServer()).get("/me").set("authorization", `Bearer ${bearer}`);

  /** Records every email the API sends until `stop`, to read the new invitation's link. */
  function watchEmails() {
    const sent: NotificationDelivery[] = [];
    const email = app.get<NotificationAdapters>(NOTIFICATION_ADAPTERS).for("email");
    const send = email.send.bind(email);
    const spy = vi.spyOn(email, "send").mockImplementation(async (delivery) => {
      sent.push(delivery);
      return send(delivery);
    });
    const inviteLink = async (): Promise<string> => {
      await vi.waitFor(() => expect(sent.some((d) => d.templateKey === "staff.invite")).toBe(true));
      const mail = sent.find((d) => d.templateKey === "staff.invite");
      const text = mail?.content.kind === "email" ? mail.content.text : "";
      return /activate\?token=([^\s]+)/.exec(text)?.[1] ?? "";
    };
    return { inviteLink, stop: () => spy.mockRestore() };
  }

  /** An invited staff member activated through AMPM's own routes: their grant's access token. */
  async function activeStaff(): Promise<{ id: string; accessToken: string }> {
    const email = `activate-ampm-${randomUUID()}@example.com`;
    const user = await prisma.user.create({
      data: { userType: "staff", name: "Asha Staff", email, status: "invited" },
      select: { id: true },
    });
    const token = await prisma.$transaction((tx) => issueInviteToken(tx, user.id));
    const set = await post("/auth/activation/password", { token, password: PASSWORD });
    expect(set.status).toBe(200);
    const secret: string = set.body.data.enrolment.secret;
    const code = totpAt(secret, stepAt(new Date()));
    const confirmed = await post("/auth/activation/confirm", { token, code });
    expect(confirmed.status).toBe(200);
    return { id: user.id, accessToken: confirmed.body.data.accessToken };
  }

  it("answers 404 to a revoked token with a fresh invitation after an administrator's reset", async () => {
    const staff = await activeStaff();
    expect((await me(staff.accessToken)).status).toBe(200);

    const emails = watchEmails();
    const admin = await keys.tokens.mint("local:admin");
    const reset = await post(`/admin/staff-users/${staff.id}/reset-authenticator`, {}, admin);
    expect(reset.status).toBe(200);
    const invite = await emails.inviteLink();
    emails.stop();

    // The reset revoked the session, so a guarded route refuses the token, yet its signature verifies.
    expect((await me(staff.accessToken)).status).toBe(401);
    await expect(keys.tokens.verifyAccessToken(staff.accessToken)).resolves.toMatchObject({
      subject: `ampm:${staff.id}`,
      provider: "ampm",
    });

    const activated = await post("/auth/activate", { token: invite }, staff.accessToken);
    expect(activated.status).toBe(404);
    expect(activated.body.error.code).toBe("not_found");

    // Nothing moved: still invited with no credentials, and the invitation still activates the real way.
    const after = await prisma.user.findUniqueOrThrow({ where: { id: staff.id } });
    expect(after).toMatchObject({ status: "invited", passwordHash: null, totpSecretEnc: null });
    const set = await post("/auth/activation/password", { token: invite, password: PASSWORD });
    expect(set.status).toBe(200);
  });

  it("answers 404 to a live token and to none, so the route does not exist under ampm", async () => {
    const staff = await activeStaff();
    const activated = await post("/auth/activate", { token: "no-such-invite" }, staff.accessToken);
    expect(activated.status).toBe(404);
    expect((await post("/auth/activate", { token: "no-such-invite" })).status).toBe(404);
  });
});
