/*
 * A hotel's web address as a key (D-188 §6): the proposed-address key of a new-hotel information request
 * (`hotel_info_requests.proposed_web_address_key`) and the duplicate hints compare these, never the text
 * as typed. The key leaves the scheme out: `http://` and `https://` name one hotel's site, so one address
 * typed both ways can never hold two live requests. Parsing is the WHATWG URL's, so an internationalised
 * host becomes punycode (UTS #46) as a browser would send it: Node's URL (the API computes every stored
 * key) and the browsers do it, and so does Expo's URL on native (whatwg-url-minimum carries the IDNA
 * mapping), so the staff app agrees. An address that names a user (`user:pass@host`, typed with or without
 * a scheme) is refused rather than stripped: no hotel's public address has one, the text is stored as
 * typed, and an email typed in the address field must not be read as its domain.
 */

// Core has no DOM or Node types; the WHATWG URL exists in every runtime the package runs in.
declare const URL: new (input: string) => {
  readonly protocol: string;
  readonly username: string;
  readonly password: string;
  readonly hostname: string;
  readonly port: string;
  readonly pathname: string;
};

/** The longest key `hotel_info_requests.proposed_web_address_key` holds (varchar(2048)). */
export const WEB_ADDRESS_KEY_MAX_LENGTH = 2048;

/** A leading scheme and what follows its colon. */
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:([\s\S]*)$/;
/** After a colon, a port: so `hotel.example:8080/rooms` is a host and a port, not a scheme. */
const PORT = /^\d+(?:[/?#]|$)/;
/** An `@` before any `/`, `?` or `#`: `user:pass@host` names a user, not a scheme `user:`. */
const USER_INFO = /^[^/?#]*@/;

interface ParsedWebAddress {
  readonly host: string;
  readonly port: string;
  readonly path: string;
}

/** The address with a scheme: as typed when it has one (any scheme), otherwise https. */
function withScheme(text: string): string {
  if (text.startsWith("//")) return `https:${text}`;
  const scheme = SCHEME.exec(text);
  if (scheme && !PORT.test(scheme[1] ?? "") && !USER_INFO.test(text)) return text;
  return `https://${text}`;
}

function parse(text: string): ParsedWebAddress | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  let url: InstanceType<typeof URL>;
  try {
    url = new URL(withScheme(trimmed));
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username !== "" || url.password !== "") return null;
  const host = url.hostname.replace(/^www\./, "").replace(/\.+$/, "");
  if (host === "") return null;
  return {
    host,
    port: url.port,
    path: url.pathname.replace(/\/+$/, ""),
  };
}

/**
 * A web address as a key: no scheme (http and https are one address), the host lower-case in punycode
 * without a leading `www.` or trailing dots, a port only when it is not its scheme's default (text with
 * no scheme reads as https), the path as browsers encode it without trailing slashes, and no query or
 * fragment. {@link webAddressHost} compares hosts alone. Null for text that is not an http or https
 * address, names a user or password (with or without a scheme), or whose key would not fit its column.
 *
 * @example
 * normaliseWebAddress(" HTTPS://WWW.Synthetic-Hotel.Example/Rooms/?tab=a "); // "synthetic-hotel.example/Rooms"
 * normaliseWebAddress("http://synthetic-hotel.example/rooms"); // "synthetic-hotel.example/rooms"
 * normaliseWebAddress("www.Bücher.example"); // "xn--bcher-kva.example"
 */
export function normaliseWebAddress(text: string): string | null {
  const parsed = parse(text);
  if (parsed === null) return null;
  const port = parsed.port === "" ? "" : `:${parsed.port}`;
  const key = `${parsed.host}${port}${parsed.path}`;
  return key.length > WEB_ADDRESS_KEY_MAX_LENGTH ? null : key;
}

/**
 * A web address's host as the duplicate hints compare it: lower-case punycode without a leading `www.`,
 * whatever the scheme, port or path. Null where {@link normaliseWebAddress} reads no address.
 *
 * @example
 * webAddressHost("http://WWW.Synthetic-Hotel.Example:8443/Rooms"); // "synthetic-hotel.example"
 */
export function webAddressHost(text: string): string | null {
  return parse(text)?.host ?? null;
}
