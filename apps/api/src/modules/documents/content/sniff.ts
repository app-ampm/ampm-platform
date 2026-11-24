import { fromFile, refuse } from "./refusal.js";

/*
 * Families by the first bytes (D-187 §2): PDF, ZIP (an Office package candidate), compound file (the
 * older .ppt and .xls), JPEG and PNG for documents, and WebP, GIF and the ISO media box (`ftyp`) for media.
 * The family only says which reader decides the kind; the readers check the rest.
 */

export type Family = "pdf" | "zip" | "cfb" | "jpeg" | "png" | "webp" | "gif" | "ftyp";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const CFB_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
export const ZIP_LOCAL_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

const ascii = (bytes: Buffer, start: number, end: number): string =>
  bytes.subarray(start, end).toString("latin1");

const FAMILIES: ReadonlyArray<{ family: Family; match: (b: Buffer) => boolean }> = [
  { family: "pdf", match: (b) => ascii(b, 0, 5) === "%PDF-" },
  { family: "zip", match: (b) => b.subarray(0, 4).equals(ZIP_LOCAL_SIGNATURE) },
  { family: "cfb", match: (b) => b.subarray(0, 8).equals(CFB_SIGNATURE) },
  {
    family: "jpeg",
    match: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  { family: "png", match: (b) => b.subarray(0, 8).equals(PNG) },
  { family: "webp", match: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP" },
  { family: "gif", match: (b) => ["GIF87a", "GIF89a"].includes(ascii(b, 0, 6)) },
  { family: "ftyp", match: (b) => b.length >= 16 && ascii(b, 4, 8) === "ftyp" },
];

/** The family the first bytes name, or null for a file no reader takes. */
export function sniffFamily(bytes: Buffer): Family | null {
  return FAMILIES.find((candidate) => candidate.match(bytes))?.family ?? null;
}

/**
 * The HEIF and AVIF brands (ISO/IEC 23008-12, the AV1 image format and MIAF): still images and image
 * sequences that share MP4's box structure. A file naming one of them is a photo, never a video.
 */
const IMAGE_BRANDS: ReadonlySet<string> = new Set([
  "mif1",
  "mif2",
  "msf1",
  "miaf",
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "hevm",
  "hevs",
  "heif",
  "avif",
  "avis",
  "avio",
  "jpgs",
  "j2ki",
  "j2is",
  "MiHA",
  "MiHB",
  "MiHE",
  "MiAC",
  "MiCm",
  "MiPr",
]);

/** The longest `ftyp` box read: a size, a type, a major brand, a version and 60 compatible brands. */
const MAX_FTYP_BYTES = 256;

/**
 * What an ISO media file is, from its `ftyp` box: "image" when its major or any compatible brand is a
 * HEIF or AVIF brand, otherwise "video" (served as MP4). A box whose size cannot hold its brands is damaged.
 */
export function ftypMedia(bytes: Buffer): "image" | "video" {
  const size = bytes.readUInt32BE(0);
  if (size < 16 || size > MAX_FTYP_BYTES || size > bytes.length || size % 4 !== 0) {
    refuse("file_damaged", `an ftyp box of ${fromFile(size)} bytes`);
  }
  const brands = [ascii(bytes, 8, 12)];
  for (let offset = 16; offset < size; offset += 4) brands.push(ascii(bytes, offset, offset + 4));
  return brands.some((brand) => IMAGE_BRANDS.has(brand)) ? "image" : "video";
}
