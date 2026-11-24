import { describe, expect, it } from "vitest";

import { checkPdf, REFUSED_NAMES } from "./pdf-check.js";
import { buildPdf, type PdfBuildOptions } from "./testing/pdf-builder.js";
import { refusalOf } from "./testing/refusals.js";

const EMBEDDED = [
  { num: 6, body: "<< /Type /EmbeddedFile >>", stream: Buffer.from("Sample Hotel") },
  { num: 7, body: "<< /Type /Filespec /F (menu.txt) /EF << /F 6 0 R >> >>" },
];

describe("checkPdf: a plain PDF passes (D-187 §2)", () => {
  it.each<[string, PdfBuildOptions]>([
    ["with a direct /Length", {}],
    ["with an indirect /Length written after the stream", { length: "indirect" }],
    ["with its objects in an object stream", { objectStream: true }],
    ["with a URI link", { catalog: "/OpenAction << /S /URI /URI (https://example.com) >>" }],
  ])("accepts a PDF %s", (_name, options) => {
    expect(() => checkPdf(buildPdf(options))).not.toThrow();
  });
});

describe("checkPdf: refused names, outside and inside object streams", () => {
  it.each<[string, PdfBuildOptions]>([
    [
      "JavaScript in an OpenAction",
      { catalog: "/OpenAction << /S /JavaScript /JS (app.alert(1)) >>" },
    ],
    ["a /JS key alone", { catalog: "/AA << /O << /JS 9 0 R >> >>" }],
    ["a Launch action", { catalog: "/OpenAction << /S /Launch /F (calc.exe) >>" }],
    ["an embedded file", { objects: EMBEDDED }],
    ["the EmbeddedFiles name tree", { catalog: "/Names << /EmbeddedFiles << /Names [] >> >>" }],
    ["rich media", { objects: [{ num: 6, body: "<< /Type /Annot /Subtype /RichMedia >>" }] }],
    ["an XFA form", { catalog: "/AcroForm << /Fields [] /XFA 9 0 R >>" }],
    ["a GoToE action", { catalog: "/OpenAction << /S /GoToE /T << /R /C /N (x) >> >>" }],
    ["an escaped name", { catalog: "/OpenAction << /S /J#61vaScript /J#53 (x) >>" }],
    [
      "JavaScript inside an object stream",
      { objectStream: true, catalog: "/OpenAction << /S /JavaScript /JS (app.alert(1)) >>" },
    ],
    [
      "a file specification's /EF inside an object stream",
      { objectStream: true, objects: [EMBEDDED[1]!] },
    ],
    [
      "a file attachment whose stream has no /Type",
      {
        objects: [
          { num: 6, body: "<< >>", stream: Buffer.from("x") },
          {
            num: 7,
            body: "<< /Type /Annot /Subtype /FileAttachment /FS << /F (menu.txt) /EF << /F 6 0 R >> >> >>",
          },
        ],
      },
    ],
    [
      "a name in an incremental update after %%EOF",
      { tail: Buffer.from("8 0 obj << /S /Launch >> endobj\n") },
    ],
  ])("refuses %s", async (_name, options) => {
    expect((await refusalOf(() => checkPdf(buildPdf(options)))).reason).toBe("pdf_active_content");
  });

  /** Written out here, not read from REFUSED_NAMES: dropping a name from the set fails its own case. */
  const EVERY_REFUSED_NAME = [
    "JavaScript",
    "JS",
    "Launch",
    "EmbeddedFile",
    "EmbeddedFiles",
    "EF",
    "RichMedia",
    "XFA",
    "GoToE",
  ];

  it("has a case below for every refused name", () => {
    expect([...REFUSED_NAMES].sort()).toEqual([...EVERY_REFUSED_NAME].sort());
  });

  it.each(EVERY_REFUSED_NAME)(
    "refuses /%s on its own, outside and inside an object stream",
    async (name) => {
      for (const objectStream of [false, true]) {
        const pdf = buildPdf({
          objectStream,
          objects: [{ num: 6, body: `<< /Type /Example /Value /${name} >>` }],
        });
        expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_active_content");
      }
    },
  );

  it("does not take a name inside a string for a name", () => {
    const pdf = buildPdf({
      objects: [{ num: 6, body: "<< /Title (about /JavaScript and /Launch) >>" }],
    });
    expect(() => checkPdf(pdf)).not.toThrow();
  });

  it("does not read names inside ordinary streams", () => {
    const pdf = buildPdf({
      objects: [{ num: 6, body: "<< >>", stream: Buffer.from("/JS gs /Launch Do") }],
    });
    expect(() => checkPdf(pdf)).not.toThrow();
  });
});

/** An object a viewer could reach through the cross-reference table, whatever surrounds it. */
const HIDDEN = "9 0 obj << /S /JavaScript /JS (app.alert(1)) >> endobj";

describe("checkPdf: every object header is one the check read", () => {
  it.each<[string, PdfBuildOptions]>([
    ["in a comment", { objects: [{ num: 6, body: `<< /Type /Example >>\n% ${HIDDEN}\n` }] }],
    ["in a string", { objects: [{ num: 6, body: `<< /Title (${HIDDEN}) >>` }] }],
    [
      "in an uncompressed stream's data",
      { objects: [{ num: 6, body: "<< >>", stream: Buffer.from(`${HIDDEN}\n`) }] },
    ],
    [
      "in the data of a stream that only claims to be compressed",
      {
        objects: [
          { num: 6, body: "<< /Filter /FlateDecode >>", stream: Buffer.from(`${HIDDEN}\n`) },
        ],
      },
    ],
    [
      "in a string, with a comment between its numbers and obj",
      { objects: [{ num: 6, body: "<< /Title (9 0 %\nobj << /S /JavaScript >> endobj) >>" }] },
    ],
  ])("refuses an object hidden %s", async (_name, options) => {
    expect((await refusalOf(() => checkPdf(buildPdf(options)))).reason).toBe("pdf_unreadable");
  });

  it("accepts a header across lines and a comment, and the word obj in text", () => {
    const pdf = buildPdf({
      objects: [{ num: 6, body: "<< /Title (an obj file: rooms 1 2 objects) >>" }],
      tail: Buffer.from("9\n0 % a note\nobj << /Type /Example >> endobj\n"),
    });
    expect(() => checkPdf(pdf)).not.toThrow();
  });
});

describe("checkPdf: in linear time", () => {
  it("reads a word of 200,000 digits ending in a letter in under a second", () => {
    const pdf = Buffer.from(`%PDF-1.7\n${"1".repeat(200_000)}x\n%%EOF\n`, "latin1");
    const started = performance.now();
    checkPdf(pdf);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("checkPdf: unreadable PDFs", () => {
  it("refuses a stream without endstream", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /Length 999 >> stream\nSample Hotel");
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });

  it("refuses an object stream with a filter it cannot decode", async () => {
    const pdf = Buffer.from(
      "%PDF-1.7\n9 0 obj << /Type /ObjStm /N 1 /First 4 /Filter /LZWDecode /Length 4 >> stream\nabcd\nendstream endobj\n%%EOF",
    );
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });

  it("refuses an object stream that does not inflate", async () => {
    const pdf = Buffer.from(
      "%PDF-1.7\n9 0 obj << /N 1 /First 4 /Filter /FlateDecode /Length 4 >> stream\nabcd\nendstream endobj\n%%EOF",
    );
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });

  it("refuses a stream whose dictionary never closed", async () => {
    const pdf = Buffer.from("%PDF-1.7\n1 0 obj << /Length 4 stream\nabcd\nendstream endobj");
    expect((await refusalOf(() => checkPdf(pdf))).reason).toBe("pdf_unreadable");
  });

  it("finds the stream end by searching when /Length is wrong", () => {
    const pdf = Buffer.from(
      "%PDF-1.7\n1 0 obj << /Length 2 >> stream\nSample Hotel\nendstream endobj\n%%EOF",
    );
    expect(() => checkPdf(pdf)).not.toThrow();
  });
});
