import { type CfbNode, writeCompoundFile } from "./cfb-writer.js";

/*
 * The smallest .xls and .ppt streams the compound file rules read, for the specs: a BIFF8 workbook
 * stream ([MS-XLS]) and a PowerPoint Document stream with its Current User stream ([MS-PPT]), each with
 * the switches a malicious case needs. Test-only: the build leaves `testing/` folders out.
 */

export function biffRecord(type: number, data: Buffer = Buffer.alloc(0)): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt16LE(type, 0);
  head.writeUInt16LE(data.length, 2);
  return Buffer.concat([head, data]);
}

function bof(substream: number): Buffer {
  const data = Buffer.alloc(16);
  data.writeUInt16LE(0x0600, 0);
  data.writeUInt16LE(substream, 2);
  return biffRecord(0x0809, data);
}

function boundSheet(name: string, sheetType: number): Buffer {
  const text = Buffer.from(name, "latin1");
  const data = Buffer.concat([Buffer.alloc(6), Buffer.from([text.length, 0]), text]);
  data.writeUInt8(sheetType, 5);
  return biffRecord(0x0085, data);
}

export interface WorkbookOptions {
  readonly filePass?: boolean;
  readonly obProj?: boolean;
  /** BoundSheet8.dt of an extra sheet: 0x01 is an Excel 4.0 macro sheet, 0x06 a VBA module. */
  readonly extraSheetType?: number;
  /** BOF.dt of the sheet substream: 0x0040 is an Excel 4.0 macro sheet. */
  readonly sheetBof?: number;
}

/** A BIFF8 workbook stream: globals, one worksheet ("Menu"), and the switches' records. */
export function workbookStream(options: WorkbookOptions = {}): Buffer {
  const globals = [
    bof(0x0005),
    ...(options.filePass ? [biffRecord(0x002f, Buffer.alloc(54))] : []),
    ...(options.obProj ? [biffRecord(0x00d3)] : []),
    boundSheet("Menu", 0x00),
    ...(options.extraSheetType === undefined ? [] : [boundSheet("Macro1", options.extraSheetType)]),
    biffRecord(0x000a),
  ];
  const cell = Buffer.alloc(14);
  const sheet = [bof(options.sheetBof ?? 0x0010), biffRecord(0x0203, cell), biffRecord(0x000a)];
  return Buffer.concat([...globals, ...sheet]);
}

export function pptRecord(type: number, data: Buffer, isContainer = false, instance = 0): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt16LE(((instance & 0x0fff) << 4) | (isContainer ? 0x0f : 0x00), 0);
  head.writeUInt16LE(type, 2);
  head.writeUInt32LE(data.length, 4);
  return Buffer.concat([head, data]);
}

export interface PresentationOptions {
  readonly vba?: boolean;
  readonly encryptedHeader?: boolean;
  readonly cryptSession?: boolean;
  /** Replaces the PowerPoint Document stream. */
  readonly document?: Buffer;
}

/** A Current User stream: the CurrentUserAtom with its header token. */
export function currentUserStream(encrypted = false): Buffer {
  const data = Buffer.alloc(20);
  data.writeUInt32LE(0x14, 0);
  data.writeUInt32LE(encrypted ? 0xf3d1c4df : 0xe391c05f, 4);
  return pptRecord(0x0ff6, Buffer.concat([data, Buffer.from("Sample", "latin1")]));
}

/** A PowerPoint Document stream: a DocumentContainer with its DocumentAtom, and the switches. */
export function presentationStream(options: PresentationOptions = {}): Buffer {
  const children = [
    pptRecord(0x03e9, Buffer.alloc(40)),
    ...(options.vba ? [pptRecord(0x03ff, pptRecord(0x0400, Buffer.alloc(12)), true)] : []),
    ...(options.cryptSession ? [pptRecord(0x2f14, Buffer.alloc(16), true)] : []),
  ];
  const document = pptRecord(0x03e8, Buffer.concat(children), true);
  const userEdit = pptRecord(0x0ff5, Buffer.alloc(28));
  return Buffer.concat([document, userEdit]);
}

/** A .xls compound file. */
export function xlsFile(options: WorkbookOptions = {}, extra: readonly CfbNode[] = []): Buffer {
  return writeCompoundFile([{ name: "Workbook", data: workbookStream(options) }, ...extra]);
}

/** A .ppt compound file. */
export function pptFile(options: PresentationOptions = {}, extra: readonly CfbNode[] = []): Buffer {
  return writeCompoundFile([
    { name: "PowerPoint Document", data: options.document ?? presentationStream(options) },
    { name: "Current User", data: currentUserStream(options.encryptedHeader) },
    ...extra,
  ]);
}
