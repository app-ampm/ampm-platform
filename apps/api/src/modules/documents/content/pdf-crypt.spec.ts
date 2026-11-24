import { describe, expect, it } from "vitest";

import { checkPdf } from "./pdf-check.js";
import { hashR6 } from "./pdf-crypt.js";
import { buildPdf } from "./testing/pdf-builder.js";
import type { TestCipher } from "./testing/pdf-encrypt.js";
import { refusalOf } from "./testing/refusals.js";

const CIPHERS: TestCipher[] = [
  "rc4-40-r2",
  "rc4-40-r3",
  "rc4-128",
  "aes-128",
  "aes-256-r5",
  "aes-256-r6",
];
const OWNER = "owner-sample";
const OPEN = "open-sample";
const SCRIPT = "/OpenAction << /S /JavaScript /JS (app.alert(1)) >>";

describe("hashR6: algorithm 2.B", () => {
  // Vectors computed independently with Python's hashlib and the openssl command line for AES-128-CBC.
  it.each([
    [
      "",
      "0101010101010101",
      "",
      "960aaa52df10df3b9b4571213288bfbccdac0c5d73a480c765d467026b303fb0",
    ],
    [
      "open-sample",
      "0202020202020202",
      "",
      "c2ad6855d2919f7f2bbaf954f7cf86f2a7fca45f5197c6d0bc4d739664b8bf2c",
    ],
    [
      "owner",
      "0303030303030303",
      "ab".repeat(48),
      "df84d7abaf6e9f69c618d4992af3d14b92a4f1b5ef23848ca358584720298456",
    ],
  ])("hashes password %j with salt %s", (password, salt, userKey, expected) => {
    const hash = hashR6(
      Buffer.from(password),
      Buffer.from(salt, "hex"),
      Buffer.from(userKey, "hex"),
    );
    expect(hash.toString("hex")).toBe(expected);
  });
});

describe("checkPdf: encryption with the empty user password (D-187 §2)", () => {
  it.each(CIPHERS)("opens a permission-locked %s PDF (owner password only)", (cipher) => {
    expect(() =>
      checkPdf(buildPdf({ encryption: { cipher, ownerPassword: OWNER } })),
    ).not.toThrow();
  });

  it.each(CIPHERS)("refuses a %s PDF that needs a password to open", async (cipher) => {
    const pdf = buildPdf({
      encryption: { cipher, userPassword: OPEN, ownerPassword: OWNER },
    });
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("password_protected");
  });

  it.each(CIPHERS)(
    "decrypts a %s object stream and finds the JavaScript inside",
    async (cipher) => {
      const pdf = buildPdf({
        objectStream: true,
        catalog: SCRIPT,
        encryption: { cipher, ownerPassword: "o" },
      });
      expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_active_content");
    },
  );

  it.each(CIPHERS)("accepts a %s object stream with nothing refused inside", (cipher) => {
    const pdf = buildPdf({ objectStream: true, encryption: { cipher, ownerPassword: "o" } });
    expect(() => checkPdf(pdf)).not.toThrow();
  });

  it("refuses a security handler other than the standard one", async () => {
    const pdf = Buffer.from(
      "%PDF-1.7\n1 0 obj << /Filter /Adobe.PubSec /V 4 /R 4 >> endobj\ntrailer << /Encrypt 1 0 R >>\n%%EOF",
    );
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("password_protected");
  });

  it.each([
    ["V3", "/V 3 /R 3"],
    ["R7", "/V 5 /R 7"],
  ])("refuses an encryption it cannot read (%s)", async (_name, version) => {
    const pdf = Buffer.from(
      `%PDF-1.7\n1 0 obj << /Filter /Standard ${version} >> endobj\ntrailer << /Encrypt 1 0 R >>\n%%EOF`,
    );
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });

  it("refuses an encryption dictionary it cannot find", async () => {
    const pdf = Buffer.from("%PDF-1.7\ntrailer << /Encrypt 9 0 R >>\n%%EOF");
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });

  it("reads a direct encryption dictionary in the trailer", async () => {
    const pdf = Buffer.from(
      "%PDF-1.7\ntrailer << /Encrypt << /Filter /Standard /V 9 /R 9 >> >>\n%%EOF",
    );
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });
});
