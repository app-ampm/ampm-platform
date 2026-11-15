import { csvCell, csvText } from "./csv";

describe("csvCell", () => {
  it("leaves a plain field as it is", () => {
    expect(csvCell("Nisha & Arjun")).toBe("Nisha & Arjun");
  });

  it("quotes a field with a comma, quote or newline, doubling inner quotes", () => {
    expect(csvCell('Sharma, "the elder"')).toBe('"Sharma, ""the elder"""');
    expect(csvCell("two\nlines")).toBe('"two\nlines"');
  });

  it.each(['=HYPERLINK("http://x")', "+91 98765", "-1", "@SUM(A1)", "\tcmd"])(
    "keeps %j as text, never a formula",
    (value) => {
      expect(csvCell(value).replace(/^"/, "").startsWith("'")).toBe(true);
    },
  );
});

describe("csvText", () => {
  it("joins fields with commas and rows with CRLF", () => {
    expect(
      csvText([
        ["a", "b"],
        ["c", "d, e"],
      ]),
    ).toBe('a,b\r\nc,"d, e"');
  });
});
