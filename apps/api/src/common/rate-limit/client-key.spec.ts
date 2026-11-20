import { describe, expect, it } from "vitest";

import { clientKey } from "./client-key.js";

describe("clientKey", () => {
  it("keeps an IPv4 address, and treats an IPv4-mapped IPv6 address as IPv4", () => {
    expect(clientKey("203.0.113.7")).toBe("203.0.113.7");
    expect(clientKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
  });

  it("groups every address of one IPv6 /64 together, whatever its spelling", () => {
    const a = clientKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd");
    expect(a).toBe("2001:db8:1:2::/64");
    expect(clientKey("2001:0db8:0001:0002::1")).toBe(a);
    expect(clientKey("2001:DB8:1:2::ffff")).toBe(a);
    expect(clientKey("2001:db8:1:3::1")).not.toBe(a);
  });

  it("expands a compressed prefix", () => {
    expect(clientKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(clientKey("::1")).toBe("0:0:0:0::/64");
  });

  it("falls back to a fixed key when the address is unknown", () => {
    expect(clientKey(null)).toBe("unknown");
    expect(clientKey("")).toBe("unknown");
  });
});
