import { fromFile, refuse } from "./refusal.js";
import { decodeXmlEntities, type XmlEvents, XmlScanner } from "./xml-scan.js";

/*
 * The content rules inside an Office package's XML parts (D-187 §2), checked while the part streams
 * through the tokenizer:
 * - PowerPoint's `ppaction://program`, `ppaction://macro` and `ppaction://ole` actions, in any attribute
 *   once character references are decoded (`&#112;paction://` is the same action to PowerPoint);
 * - DDE formulas (`app|topic!item`) in worksheet cells, defined names, data validation, conditional
 *   formatting, charts and the VML form controls (`x:Fmla…`): a `|` outside a formula's string literals.
 */

const PROGRAM_ACTION = /ppaction:\/\/(?:program|macro|ole)/i;
const FORMULA_ELEMENTS: ReadonlySet<string> = new Set([
  "f",
  "formula",
  "formula1",
  "formula2",
  "definedname",
]);
export const MAX_FORMULA_BYTES = 256 * 1024;

const isFormulaElement = (local: string): boolean =>
  FORMULA_ELEMENTS.has(local.toLowerCase()) || local.startsWith("Fmla");

const TAG_NAME = /^<([^\s/>]+)/;

/** A start tag's element name without its prefix, read without parsing the attributes. */
function localName(raw: string): string {
  const name = TAG_NAME.exec(raw)?.[1] ?? "";
  return name.slice(name.indexOf(":") + 1);
}

/**
 * True when a formula reads data from another program through DDE: a `|` outside its double-quoted
 * string literals. A sheet name that holds a `|` is refused with it; such names are rare, and this way no
 * spelling of the application part slips through.
 */
export function isDdeFormula(formula: string): boolean {
  return formula.replace(/"(?:[^"]|"")*"/g, '""').includes("|");
}

class PartRules implements XmlEvents {
  private depth = 0;
  private formulaDepth = -1;
  private formula: Buffer[] = [];
  private formulaBytes = 0;
  scanner: XmlScanner | null = null;

  constructor(private readonly part: string) {}

  startTag(raw: string): void {
    if (PROGRAM_ACTION.test(decodeXmlEntities(raw))) {
      refuse(
        "active_content",
        `a PowerPoint program, macro or OLE action in ${fromFile(this.part)}`,
      );
    }
    if (raw.endsWith("/>")) return;
    this.depth += 1;
    if (this.formulaDepth < 0 && isFormulaElement(localName(raw)) && this.scanner) {
      this.formulaDepth = this.depth;
      this.scanner.capture = true;
    }
  }

  endTag(): void {
    if (this.depth === this.formulaDepth) this.finishFormula();
    this.depth -= 1;
  }

  text(bytes: Buffer): void {
    this.formulaBytes += bytes.length;
    if (this.formulaBytes > MAX_FORMULA_BYTES) {
      refuse("file_damaged", `a formula over ${MAX_FORMULA_BYTES} bytes in ${fromFile(this.part)}`);
    }
    this.formula.push(Buffer.from(bytes));
  }

  private finishFormula(): void {
    const formula = decodeXmlEntities(Buffer.concat(this.formula).toString("utf8"));
    if (isDdeFormula(formula))
      refuse("external_content", `a DDE formula in ${fromFile(this.part)}`);
    this.formula = [];
    this.formulaBytes = 0;
    this.formulaDepth = -1;
    if (this.scanner) this.scanner.capture = false;
  }
}

/**
 * A tokenizer that applies the part rules to one XML part as its chunks arrive.
 *
 * @example
 * const scanner = partScanner("ppt/slides/slide1.xml");
 * await inflateEntry(bytes, entry, budget, (chunk) => scanner.write(chunk));
 * scanner.end();
 */
export function partScanner(part: string): XmlScanner {
  const rules = new PartRules(part);
  const scanner = new XmlScanner(rules, part);
  rules.scanner = scanner;
  return scanner;
}
