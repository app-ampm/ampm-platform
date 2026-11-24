import { deflateSync } from "node:zlib";

import { encryptionFor, type TestEncryption } from "./pdf-encrypt.js";

/*
 * One-page PDFs for the PDF check's specs and the fixture generator: "Sample Hotel" in Helvetica, then
 * whatever a case adds (an OpenAction, an annotation, an embedded file), optionally moved into an object
 * stream (with a cross-reference stream, as readers need) and optionally encrypted. Test-only: the build
 * leaves `testing/` folders out.
 */

export interface PdfObjectSource {
  readonly num: number;
  /** The object's dictionary or value, in PDF syntax. */
  readonly body: string;
  /** Stream data; the dictionary then gets its /Length. */
  readonly stream?: Buffer;
}

export interface PdfBuildOptions {
  /** Entries added to the catalog, e.g. "/OpenAction 6 0 R". */
  readonly catalog?: string;
  readonly objects?: readonly PdfObjectSource[];
  readonly encryption?: TestEncryption;
  /** Puts every object without a stream into one object stream. */
  readonly objectStream?: boolean;
  /** How the content stream's /Length is written. */
  readonly length?: "direct" | "indirect";
  /** Raw bytes appended after %%EOF. */
  readonly tail?: Buffer;
}

const FILE_ID = Buffer.from("53616d706c65486f74656c4964303031", "hex");
const CONTENT = Buffer.from("BT /F1 24 Tf 72 720 Td (Sample Hotel) Tj ET\n", "latin1");

function baseObjects(options: PdfBuildOptions): PdfObjectSource[] {
  return [
    { num: 1, body: `<< /Type /Catalog /Pages 2 0 R ${options.catalog ?? ""} >>` },
    { num: 2, body: "<< /Type /Pages /Kids [3 0 R] /Count 1 >>" },
    {
      num: 3,
      body: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    },
    { num: 4, body: "<< >>", stream: CONTENT },
    { num: 5, body: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" },
    ...(options.objects ?? []),
  ];
}

interface Writer {
  parts: Buffer[];
  size: number;
  offsets: Map<number, { type: 1 | 2; value: number; index?: number }>;
}

function append(writer: Writer, part: Buffer | string): void {
  const bytes = typeof part === "string" ? Buffer.from(part, "latin1") : part;
  writer.parts.push(bytes);
  writer.size += bytes.length;
}

function objectStreamOf(
  objects: readonly PdfObjectSource[],
  num: number,
  writer: Writer,
): PdfObjectSource {
  let header = "";
  let body = "";
  objects.forEach((object, index) => {
    header += `${object.num} ${body.length} `;
    body += `${object.body}\n`;
    writer.offsets.set(object.num, { type: 2, value: num, index });
  });
  const data = deflateSync(Buffer.from(header + body, "latin1"));
  return {
    num,
    body: `<< /Type /ObjStm /N ${objects.length} /First ${header.length} /Filter /FlateDecode >>`,
    stream: data,
  };
}

function writeObject(
  writer: Writer,
  object: PdfObjectSource,
  options: PdfBuildOptions,
  encrypt: ((num: number, data: Buffer) => Buffer) | null,
): void {
  writer.offsets.set(object.num, { type: 1, value: writer.size });
  if (!object.stream) {
    append(writer, `${object.num} 0 obj\n${object.body}\nendobj\n`);
    return;
  }
  const data = encrypt ? encrypt(object.num, object.stream) : object.stream;
  const indirect = options.length === "indirect";
  const lengthRef = indirect ? `${100 + object.num} 0 R` : String(data.length);
  const dict = object.body.replace(/>>\s*$/, ` /Length ${lengthRef} >>`);
  append(writer, `${object.num} 0 obj\n${dict}\nstream\n`);
  append(writer, data);
  append(writer, "\nendstream\nendobj\n");
  if (indirect) {
    writer.offsets.set(100 + object.num, { type: 1, value: writer.size });
    append(writer, `${100 + object.num} 0 obj\n${data.length}\nendobj\n`);
  }
}

function xrefTable(writer: Writer, trailer: string): void {
  const start = writer.size;
  const max = Math.max(...writer.offsets.keys());
  let table = `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
  for (let num = 1; num <= max; num += 1) {
    const at = writer.offsets.get(num);
    table += at ? `${String(at.value).padStart(10, "0")} 00000 n \n` : "0000000000 65535 f \n";
  }
  append(
    writer,
    `${table}trailer\n<< /Size ${max + 1} ${trailer} >>\nstartxref\n${start}\n%%EOF\n`,
  );
}

function xrefStream(writer: Writer, trailer: string): void {
  const num = Math.max(...writer.offsets.keys()) + 1;
  const start = writer.size;
  writer.offsets.set(num, { type: 1, value: start });
  const rows = Array.from({ length: num + 1 }, (_, index) => {
    const row = Buffer.alloc(7);
    const at = writer.offsets.get(index);
    row.writeUInt8(at ? at.type : 0, 0);
    row.writeUInt32BE(at ? at.value : 0, 1);
    row.writeUInt16BE(at?.index ?? (at ? 0 : 65535), 5);
    return row;
  });
  const data = Buffer.concat(rows);
  append(
    writer,
    `${num} 0 obj\n<< /Type /XRef /Size ${num + 1} /W [1 4 2] ${trailer} /Length ${data.length} >>\nstream\n`,
  );
  append(writer, data);
  append(writer, `\nendstream\nendobj\nstartxref\n${start}\n%%EOF\n`);
}

/**
 * A one-page PDF with the options' additions.
 *
 * @example
 * const withScript = buildPdf({ catalog: "/OpenAction << /S /JavaScript /JS (app.alert(1)) >>" });
 */
export function buildPdf(options: PdfBuildOptions = {}): Buffer {
  const writer: Writer = { parts: [], size: 0, offsets: new Map() };
  append(
    writer,
    Buffer.concat([
      Buffer.from("%PDF-1.7\n%", "latin1"),
      Buffer.from([0xe2, 0xe3, 0xcf, 0xd3]),
      Buffer.from("\n"),
    ]),
  );
  const encrypted = options.encryption ? encryptionFor(options.encryption, FILE_ID) : null;
  const encrypt = encrypted
    ? (num: number, data: Buffer) => encrypted.encryptStream(num, 0, data)
    : null;
  let objects = baseObjects(options);
  if (options.objectStream) {
    const plain = objects.filter((object) => !object.stream);
    const streamNum = Math.max(...objects.map((object) => object.num)) + 1;
    objects = [
      ...objects.filter((object) => object.stream),
      objectStreamOf(plain, streamNum, writer),
    ];
  }
  for (const object of objects) writeObject(writer, object, options, encrypt);
  let trailer = `/Root 1 0 R /ID [<${FILE_ID.toString("hex")}> <${FILE_ID.toString("hex")}>]`;
  if (encrypted) {
    const num = Math.max(...writer.offsets.keys()) + 1;
    writer.offsets.set(num, { type: 1, value: writer.size });
    append(writer, `${num} 0 obj\n${encrypted.dictionary}\nendobj\n`);
    trailer += ` /Encrypt ${num} 0 R`;
  }
  if (options.objectStream) xrefStream(writer, trailer);
  else xrefTable(writer, trailer);
  if (options.tail) append(writer, options.tail);
  return Buffer.concat(writer.parts);
}
