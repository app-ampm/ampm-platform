import { describe, expect, it } from "vitest";

import { CHAT_ANCHOR_ID } from "./contact-ids";
import { displayPhone, isDemoRequest, reachOf } from "./contact-request";

describe("isDemoRequest", () => {
  it("opens the demo request for ?type=demo only", () => {
    expect(isDemoRequest("demo")).toBe(true);
    expect(isDemoRequest(["enquiry", "demo"])).toBe(true);
    expect(isDemoRequest(undefined)).toBe(false);
    expect(isDemoRequest("enquiry")).toBe(false);
    expect(isDemoRequest("DEMO")).toBe(false);
  });
});

describe("displayPhone", () => {
  it("groups an Indian mobile as the confirmation prints it (W7)", () => {
    expect(displayPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("leaves any other number as it was sent", () => {
    expect(displayPhone("+447700900123")).toBe("+447700900123");
  });
});

describe("reachOf", () => {
  const phone = "+919876543210";
  const email = "rhea@example.com";

  it("calls the mobile when no way was chosen (W7)", () => {
    expect(reachOf({ phone, email })).toEqual({ channel: "call", address: "+91 98765 43210" });
    expect(reachOf({ phone, contactPreference: "phone" })).toEqual({
      channel: "call",
      address: "+91 98765 43210",
    });
  });

  it("follows the chosen way when its address was given", () => {
    expect(reachOf({ phone, contactPreference: "whatsapp" })).toEqual({
      channel: "whatsapp",
      address: "+91 98765 43210",
    });
    expect(reachOf({ phone, email, contactPreference: "email" })).toEqual({
      channel: "email",
      address: email,
    });
  });

  it("falls back to the address they did give", () => {
    expect(reachOf({ phone, contactPreference: "email" })?.channel).toBe("call");
    expect(reachOf({ email, contactPreference: "whatsapp" })).toEqual({
      channel: "email",
      address: email,
    });
    expect(reachOf({})).toBeNull();
  });
});

describe("chat anchor", () => {
  it("is the fragment the chat pill links to", () => {
    expect(CHAT_ANCHOR_ID).toBe("chat");
  });
});
