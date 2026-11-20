import { describe, expect, it, vi } from "vitest";

import { loadEnv } from "../../../env.js";
import type { SmsMessage } from "./gateway-sms.adapter.js";
import {
  Msg91SmsTransport,
  SmsProviderError,
  smsTransportFor,
  TwoFactorSmsTransport,
  type SmsFetch,
} from "./sms-transports.js";

/*
 * Offline contract tests for the two SMS providers (D-147): the exact request each one receives, how its
 * answer is read, and that no failure carries the key, the number or the text. The request shapes follow
 * the providers' own references (2Factor's API docs, R1 TRANS_SMS; MSG91's Send SMS OpenAPI spec, Flow).
 * A live test waits for the account, DLT registration and the sandbox.
 */

const MESSAGE: SmsMessage = {
  to: "+919876543210",
  text: "482913 is your AMPM sign-in code. It expires in 5 minutes. Do not share it with anyone. - AMPM",
  templateKey: "auth.client_otp",
  variables: { code: "482913" },
};
const SECRETS = ["test-api-key", "9876543210", "482913"];

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn: SmsFetch = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  });
  return { fetchFn, calls };
}

/** The failure's code, after checking it holds none of the secrets. */
async function failureCode(work: Promise<unknown>): Promise<string> {
  const error = await work.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(SmsProviderError);
  const text = error instanceof Error ? `${error.message} ${String(error.stack)}` : "";
  for (const secret of SECRETS) expect(text).not.toContain(secret);
  return error instanceof SmsProviderError ? error.code : "";
}

const TWO_FACTOR = {
  apiKey: "test-api-key",
  senderId: "AMPMVS",
  otpTemplate: "1707000000000000001",
  entityId: "1701000000000000001",
};

describe("TwoFactorSmsTransport (R1 TRANS_SMS)", () => {
  it("posts the DLT text from the header with the DLT IDs, the key in the body only", async () => {
    const { fetchFn, calls } = fakeFetch(200, { Status: "Success", Details: "ab88-279e" });
    const result = await new TwoFactorSmsTransport(TWO_FACTOR, fetchFn).sendSms(MESSAGE);
    expect(result).toEqual({ providerRef: "2factor:ab88-279e" });
    const [call] = calls;
    expect(call?.url).toBe("https://2factor.in/API/R1/");
    expect(call?.url).not.toContain("test-api-key");
    expect(call?.init.method).toBe("POST");
    const form = new URLSearchParams(String(call?.init.body));
    expect(Object.fromEntries(form)).toEqual({
      module: "TRANS_SMS",
      apikey: "test-api-key",
      to: "919876543210",
      from: "AMPMVS",
      msg: MESSAGE.text,
      ctid: "1707000000000000001",
      peid: "1701000000000000001",
    });
  });

  it("fails with a bare code on an error answer, even one sent with HTTP 200", async () => {
    const rejected = fakeFetch(400, { Status: "Error", Details: "Invalid API Key test-api-key" });
    const transport = new TwoFactorSmsTransport(TWO_FACTOR, rejected.fetchFn);
    expect(await failureCode(transport.sendSms(MESSAGE))).toBe("2factor_400");
    const odd = fakeFetch(200, { Status: "Error", Details: "9876543210" });
    const oddTransport = new TwoFactorSmsTransport(TWO_FACTOR, odd.fetchFn);
    expect(await failureCode(oddTransport.sendSms(MESSAGE))).toBe("2factor_200");
  });
});

describe("Msg91SmsTransport (Flow API)", () => {
  it("posts its template with the named variables, the key in a header", async () => {
    const { fetchFn, calls } = fakeFetch(200, { type: "success", message: "5e1e93ca" });
    const transport = new Msg91SmsTransport(
      { authKey: "test-api-key", otpTemplate: "tmpl-1" },
      fetchFn,
    );
    expect(await transport.sendSms(MESSAGE)).toEqual({ providerRef: "msg91:5e1e93ca" });
    const [call] = calls;
    expect(call?.url).toBe("https://control.msg91.com/api/v5/flow");
    expect(call?.init.headers).toMatchObject({ authkey: "test-api-key" });
    expect(JSON.parse(String(call?.init.body))).toEqual({
      template_id: "tmpl-1",
      short_url: "0",
      recipients: [{ code: "482913", mobiles: "919876543210" }],
    });
  });

  it("treats an error sent with HTTP 200 as a failure, as MSG91 does", async () => {
    const odd = fakeFetch(200, {
      type: "error",
      message: "The provided flow ID or template ID is invalid.",
    });
    const transport = new Msg91SmsTransport(
      { authKey: "test-api-key", otpTemplate: "tmpl-1" },
      odd.fetchFn,
    );
    expect(await failureCode(transport.sendSms(MESSAGE))).toBe("msg91_200");
    const denied = fakeFetch(401, { type: "error", message: "Auth Key missing" });
    const deniedTransport = new Msg91SmsTransport(
      { authKey: "test-api-key", otpTemplate: "tmpl-1" },
      denied.fetchFn,
    );
    expect(await failureCode(deniedTransport.sendSms(MESSAGE))).toBe("msg91_401");
  });
});

describe("either transport", () => {
  it("fails with sms_network when the provider cannot be reached", async () => {
    const down: SmsFetch = vi.fn(async () => {
      throw new Error("connect ECONNREFUSED https://2factor.in/API/R1/ apikey=test-api-key");
    });
    expect(await failureCode(new TwoFactorSmsTransport(TWO_FACTOR, down).sendSms(MESSAGE))).toBe(
      "sms_network",
    );
  });

  it("refuses a template no DLT template is registered for, before calling the provider", async () => {
    const { fetchFn, calls } = fakeFetch(200, { Status: "Success", Details: "x" });
    const other = { ...MESSAGE, templateKey: "crm.enquiry_received" };
    expect(await failureCode(new TwoFactorSmsTransport(TWO_FACTOR, fetchFn).sendSms(other))).toBe(
      "sms_template_not_registered",
    );
    expect(calls).toHaveLength(0);
  });
});

describe("smsTransportFor", () => {
  const base = {
    DATABASE_URL: "postgres://localhost:5432/ampm",
    IDENTITY_PROVIDER: "local",
    IDENTITY_LOCAL_SECRET: "a-development-secret-that-is-32chars",
  };

  it("chooses the configured provider, or none for the console stub", () => {
    expect(smsTransportFor(loadEnv(base))).toBeNull();
    const twoFactor = loadEnv({
      ...base,
      SMS_PROVIDER: "2factor",
      SMS_API_KEY: "k",
      SMS_SENDER_ID: "AMPMVS",
      SMS_OTP_TEMPLATE: "t",
    });
    expect(smsTransportFor(twoFactor)).toBeInstanceOf(TwoFactorSmsTransport);
    const msg91 = loadEnv({
      ...base,
      SMS_PROVIDER: "msg91",
      SMS_API_KEY: "k",
      SMS_OTP_TEMPLATE: "t",
    });
    expect(smsTransportFor(msg91)).toBeInstanceOf(Msg91SmsTransport);
  });
});
