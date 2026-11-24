import { describe, expect, it } from "vitest";

import { refusalOf } from "./testing/refusals.js";
import { decodeXmlEntities, MAX_MARKUP_BYTES, XmlScanner } from "./xml-scan.js";

interface Seen {
  starts: string[];
  ends: string[];
  text: string;
}

/** Feeds `xml` in chunks of `size` bytes and records what the tokenizer reports. */
function scan(xml: string | Buffer, size = Number.MAX_SAFE_INTEGER, captureIn = "f"): Seen {
  const seen: Seen = { starts: [], ends: [], text: "" };
  const scanner: XmlScanner = new XmlScanner(
    {
      startTag: (raw) => {
        seen.starts.push(raw);
        if (raw.startsWith(`<${captureIn}`)) scanner.capture = true;
      },
      endTag: (name) => {
        seen.ends.push(name);
        scanner.capture = false;
      },
      text: (bytes) => {
        seen.text += bytes.toString("utf8");
      },
    },
    "part.xml",
  );
  const bytes = typeof xml === "string" ? Buffer.from(xml, "utf8") : xml;
  for (let at = 0; at < bytes.length; at += size) scanner.write(bytes.subarray(at, at + size));
  scanner.end();
  return seen;
}

/** `text` in UTF-16 with its byte order mark, little- or big-endian. */
function utf16(text: string, order: "le" | "be"): Buffer {
  const little = Buffer.from(text, "utf16le");
  const body = order === "le" ? little : Buffer.from(little).swap16();
  return Buffer.concat([Buffer.from(order === "le" ? [0xff, 0xfe] : [0xfe, 0xff]), body]);
}

const SAMPLE =
  '<?xml version="1.0" encoding="UTF-8"?><!-- a -- comment --><r a="1 > 0" b=\'x\'><f>A1|B<![CDATA[ & ]]>2</f><e/></r>';

describe("XmlScanner", () => {
  it("reports start tags, end tags and captured text, quotes and comments included", () => {
    expect(scan(SAMPLE)).toEqual({
      starts: ["<r a=\"1 > 0\" b='x'>", "<f>", "<e/>"],
      ends: ["f", "r"],
      text: "A1|B & 2",
    });
  });

  it("gives the same events whatever the chunk boundaries (one byte at a time)", () => {
    for (const size of [1, 2, 3, 7]) expect(scan(SAMPLE, size)).toEqual(scan(SAMPLE));
  });

  it("skips a UTF-8 byte order mark", () => {
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("<r/>")]);
    expect(scan(withBom).starts).toEqual(["<r/>"]);
  });

  it.each([
    ["a DTD", '<!DOCTYPE r [<!ENTITY x "y">]><r/>'],
    ["an entity declaration", "<!ENTITY x 'y'><r/>"],
    ["UTF-8 that declares another encoding", '<?xml version="1.0" encoding="UTF-16"?><r/>'],
    ["UTF-16 without a byte order mark", Buffer.from("<r/>", "utf16le")],
    ["UTF-16 that declares UTF-8", utf16('<?xml version="1.0" encoding="UTF-8"?><r/>', "le")],
    [
      "UTF-16 that ends in half a character",
      Buffer.concat([utf16("<r/>", "be"), Buffer.from([0x3c])]),
    ],
    [
      "UTF-16 with a lone surrogate",
      Buffer.concat([
        utf16("<r a='", "le"),
        Buffer.from([0x00, 0xd8]),
        Buffer.from("'/>", "utf16le"),
      ]),
    ],
    [
      "UTF-32 with a byte order mark",
      Buffer.concat([Buffer.from([0xff, 0xfe, 0, 0]), Buffer.from("<\0\0\0r\0\0\0/\0\0\0>\0\0\0")]),
    ],
    ["markup that never closes", "<r><e attr='x"],
    ["a tag over 1 MiB", `<r a="${"x".repeat(MAX_MARKUP_BYTES)}"/>`],
  ])("refuses %s", async (_name, xml) => {
    expect((await refusalOf(() => scan(xml))).reason).toBe("file_damaged");
  });

  it.each(["le", "be"] as const)(
    "reads UTF-16 (%s) with a byte order mark as Office does, whatever the chunks",
    (order) => {
      const wide = '<?xml version="1.0" encoding="UTF-16"?><r a="Hôtel 🏨"><f>A1|B 🏨</f><e/></r>';
      const narrow = wide.replace(/^<\?xml[^>]*>/, "");
      for (const size of [1, 2, 3, 7, 64])
        expect(scan(utf16(wide, order), size)).toEqual(scan(narrow));
    },
  );

  it("accepts utf-8 declared in any case", () => {
    expect(scan('<?xml version="1.0" encoding="utf8"?><r/>').starts).toEqual(["<r/>"]);
  });
});

describe("decodeXmlEntities", () => {
  it.each([
    ["&#112;paction", "ppaction"],
    ["&#x70;paction", "ppaction"],
    ["a&amp;b&lt;c&gt;d&quot;e&apos;", "a&b<c>d\"e'"],
    ["&#0;&#x110000;", "��"],
    ["&unknown; stays", "&unknown; stays"],
  ])("decodes %s", (text, decoded) => {
    expect(decodeXmlEntities(text)).toBe(decoded);
  });
});
