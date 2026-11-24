/*
 * AES-256 PDF fixtures (revisions 5 and 6), written by the specs' own encryptor because no tool on the
 * development machine writes them (LibreOffice is not installed; pypdf needs `cryptography` for AES).
 * generate.sh then opens each one in PDFKit, an independent reader, before keeping it.
 *   node --import tsx test/fixtures/content/generate/aes256.ts <fixtures folder>   (from apps/api)
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildPdf } from "../../../../src/modules/documents/content/testing/pdf-builder.js";

const OWNER = "owner-sample";
const OPEN = "open-sample";
const folder = process.argv[2];
if (!folder) throw new Error("usage: aes256.ts <fixtures folder>");

const fixtures = [
  {
    name: "test-encryptor-aes-256-r5-owner-only.pdf",
    pdf: buildPdf({ encryption: { cipher: "aes-256-r5", ownerPassword: OWNER } }),
  },
  {
    name: "test-encryptor-aes-256-r6-owner-only-object-stream.pdf",
    pdf: buildPdf({
      objectStream: true,
      encryption: { cipher: "aes-256-r6", ownerPassword: OWNER },
    }),
  },
  {
    name: "test-encryptor-aes-256-r6-user-password.pdf",
    pdf: buildPdf({
      encryption: {
        cipher: "aes-256-r6",
        userPassword: OPEN,
        ownerPassword: OWNER,
      },
    }),
  },
];

for (const fixture of fixtures) {
  writeFileSync(join(folder, fixture.name), fixture.pdf);
  console.log(`wrote ${fixture.name}`);
}
