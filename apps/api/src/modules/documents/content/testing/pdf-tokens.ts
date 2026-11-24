import { PdfLexer, type PdfToken } from "../pdf-lexer.js";

/** Every token of `text`, for the PDF specs. Test-only: the build leaves `testing/` folders out. */
export function tokensOf(text: string | Buffer): PdfToken[] {
  const lexer = new PdfLexer(typeof text === "string" ? Buffer.from(text, "latin1") : text);
  const out: PdfToken[] = [];
  for (let token = lexer.next(); token; token = lexer.next()) out.push(token);
  return out;
}
