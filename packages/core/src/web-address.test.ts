import { describe, expect, it } from "vitest";

import { normaliseWebAddress, WEB_ADDRESS_KEY_MAX_LENGTH, webAddressHost } from "./web-address";

/*
 * A hotel's web address as a key (D-188 §6): the proposed-address key of a new-hotel request and the
 * duplicate hints compare these, never the text as typed.
 */
describe("normaliseWebAddress", () => {
  it("lower-cases the host and drops the scheme, www., the trailing slash, the query and the fragment", () => {
    expect(normaliseWebAddress(" HTTPS://WWW.Synthetic-Hotel.Example/Rooms/?tab=a#top ")).toBe(
      "synthetic-hotel.example/Rooms",
    );
    expect(normaliseWebAddress("https://synthetic-hotel.example/")).toBe("synthetic-hotel.example");
    expect(normaliseWebAddress("https://synthetic-hotel.example/rooms///")).toBe(
      "synthetic-hotel.example/rooms",
    );
  });

  it("reads an address typed without a scheme as the same address", () => {
    expect(normaliseWebAddress("www.synthetic-hotel.example")).toBe("synthetic-hotel.example");
    expect(normaliseWebAddress("synthetic-hotel.example:8080/Stay")).toBe(
      "synthetic-hotel.example:8080/Stay",
    );
    expect(normaliseWebAddress("//synthetic-hotel.example/x")).toBe("synthetic-hotel.example/x");
  });

  it("drops the scheme, so http and https are one hotel's address, typed either way", () => {
    expect(normaliseWebAddress("http://synthetic-hotel.example")).toBe(
      normaliseWebAddress("https://synthetic-hotel.example"),
    );
    expect(normaliseWebAddress("HTTP://www.Synthetic-Hotel.Example/Rooms/")).toBe(
      normaliseWebAddress("synthetic-hotel.example/Rooms"),
    );
  });

  it("keeps a port that is not its scheme's default", () => {
    expect(normaliseWebAddress("http://Synthetic-Hotel.Example:8080/")).toBe(
      "synthetic-hotel.example:8080",
    );
    expect(normaliseWebAddress("https://synthetic-hotel.example:443/a")).toBe(
      "synthetic-hotel.example/a",
    );
    expect(normaliseWebAddress("http://synthetic-hotel.example:80/a")).toBe(
      "synthetic-hotel.example/a",
    );
  });

  it("turns an internationalised host into punycode and keeps the path's case", () => {
    expect(normaliseWebAddress("https://www.Bücher.example/Zimmer/")).toBe(
      "xn--bcher-kva.example/Zimmer",
    );
  });

  it("drops every trailing dot of the host", () => {
    expect(normaliseWebAddress("https://synthetic-hotel.example./")).toBe(
      "synthetic-hotel.example",
    );
    expect(normaliseWebAddress("https://synthetic-hotel.example.../rooms")).toBe(
      "synthetic-hotel.example/rooms",
    );
    expect(normaliseWebAddress("www.synthetic-hotel.example..")).toBe("synthetic-hotel.example");
  });

  it("refuses a user name or password, typed with or without a scheme: no hotel's address has one", () => {
    for (const text of [
      "https://user:secret@synthetic-hotel.example/a",
      "http://user@synthetic-hotel.example",
      "user:secret@synthetic-hotel.example",
      "sales:1234@synthetic-hotel.example/rooms",
      "sales@synthetic-hotel.example",
      "//user:secret@synthetic-hotel.example",
      "synthetic-hotel.example:8080@elsewhere.example",
    ]) {
      expect(normaliseWebAddress(text), text).toBeNull();
      expect(webAddressHost(text), text).toBeNull();
    }
  });

  it("removes one leading www. only", () => {
    expect(normaliseWebAddress("https://www.www.synthetic-hotel.example")).toBe(
      "www.synthetic-hotel.example",
    );
    expect(normaliseWebAddress("https://www2.synthetic-hotel.example")).toBe(
      "www2.synthetic-hotel.example",
    );
  });

  it("percent-encodes the path as browsers do", () => {
    expect(normaliseWebAddress("https://synthetic-hotel.example/our rooms")).toBe(
      "synthetic-hotel.example/our%20rooms",
    );
  });

  it("answers null for text that is not an http or https address", () => {
    for (const text of [
      "",
      "   ",
      "not a web address",
      "ftp://synthetic-hotel.example",
      "mailto:sales@synthetic-hotel.example",
      "javascript:alert(1)",
      "https://www./",
      "https://",
    ]) {
      expect(normaliseWebAddress(text), JSON.stringify(text)).toBeNull();
    }
  });

  it("answers null when the key would be longer than its column", () => {
    const path = "é".repeat(400); // nine characters each once percent-encoded
    expect(normaliseWebAddress(`https://synthetic-hotel.example/${path}`)).toBeNull();
    const fits = `https://synthetic-hotel.example/${"a".repeat(1000)}`;
    expect(normaliseWebAddress(fits)?.length).toBeLessThanOrEqual(WEB_ADDRESS_KEY_MAX_LENGTH);
  });
});

describe("webAddressHost", () => {
  it("drops every trailing dot, as the key does", () => {
    expect(webAddressHost("https://synthetic-hotel.example../")).toBe("synthetic-hotel.example");
  });

  it("is the normalised host alone: no scheme, www., port or path", () => {
    expect(webAddressHost("https://WWW.Synthetic-Hotel.Example:8443/Rooms?a=1")).toBe(
      "synthetic-hotel.example",
    );
    expect(webAddressHost("http://synthetic-hotel.example")).toBe(
      webAddressHost("https://www.synthetic-hotel.example/"),
    );
    expect(webAddressHost("www.Bücher.example")).toBe("xn--bcher-kva.example");
  });

  it("answers null where normaliseWebAddress does", () => {
    expect(webAddressHost("ftp://synthetic-hotel.example")).toBeNull();
    expect(webAddressHost("not a web address")).toBeNull();
  });
});
