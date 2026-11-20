import { isIPv4, isIPv6 } from "node:net";

/**
 * The client network a limit counts against: an IPv4 address as it is, and an IPv6 address by its /64
 * prefix. One IPv6 subscriber usually holds a whole /64, so keying by the full address would let it
 * rotate through addresses and never reach a limit (D-142 security review). An IPv4-mapped IPv6 address
 * (`::ffff:1.2.3.4`) counts as its IPv4 address.
 *
 *   clientKey("2001:db8:1:2:aaaa::1") === clientKey("2001:db8:1:2:bbbb::9"); // true
 */
export function clientKey(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  if (isIPv4(ip)) return ip;
  if (!isIPv6(ip)) return ip;
  return `${expandIPv6(ip).slice(0, 4).join(":")}::/64`;
}

/** The eight 16-bit groups of an IPv6 address, lower case, with `::` filled in. */
function expandIPv6(ip: string): string[] {
  const [head = "", tail] = ip.toLowerCase().split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const missing = 8 - left.length - right.length;
  return [...left, ...Array.from({ length: Math.max(missing, 0) }, () => "0"), ...right].map(
    (group) => group.replace(/^0+(?=.)/, ""),
  );
}
