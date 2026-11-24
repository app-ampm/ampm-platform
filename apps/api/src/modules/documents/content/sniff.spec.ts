import { describe, expect, it } from "vitest";

import { ContentRefusal } from "./refusal.js";
import { ftypMedia, sniffFamily } from "./sniff.js";

const bytes = (...parts: Array<string | number[]>): Buffer =>
  Buffer.concat(parts.map((part) => Buffer.from(part)));

/** An `ftyp` box: size, type, major brand, minor version and compatible brands. */
function ftyp(major: string, compatible: string[], size?: number): Buffer {
  const body = Buffer.concat([
    Buffer.from(major, "latin1"),
    Buffer.alloc(4),
    ...compatible.map((brand) => Buffer.from(brand, "latin1")),
  ]);
  const head = Buffer.alloc(8);
  head.writeUInt32BE(size ?? body.length + 8, 0);
  head.write("ftyp", 4, "latin1");
  return Buffer.concat([head, body, Buffer.alloc(16)]);
}

describe("sniffFamily: the family by the first bytes (D-187 §2)", () => {
  it.each([
    ["pdf", bytes("%PDF-1.7\n")],
    ["zip", bytes([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00])],
    ["cfb", bytes([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00])],
    ["jpeg", bytes([0xff, 0xd8, 0xff, 0xe0])],
    ["png", bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])],
    ["webp", bytes("RIFF", [0x10, 0, 0, 0], "WEBPVP8 ")],
    ["gif", bytes("GIF89a", [1, 0])],
    ["gif", bytes("GIF87a", [1, 0])],
    ["ftyp", ftyp("isom", ["isom", "mp41"])],
  ])("recognises %s", (family, content) => {
    expect(sniffFamily(content)).toBe(family);
  });

  it.each([
    ["an executable", bytes("MZ", [0x90, 0x00])],
    ["an HTML page", bytes("<!doctype html><script>")],
    ["a truncated PDF header", bytes("%PDF")],
    ["an empty ZIP (end record only)", bytes([0x50, 0x4b, 0x05, 0x06], Array(18).fill(0))],
    ["an empty file", Buffer.alloc(0)],
    ["a TIFF", bytes("II*\0")],
    ["a RIFF that is not WebP", bytes("RIFF", [0, 0, 0, 0], "WAVEfmt ")],
  ])("names no family for %s", (_name, content) => {
    expect(sniffFamily(content)).toBeNull();
  });
});

describe("ftypMedia: HEIF and AVIF are photos, not videos", () => {
  it.each([
    ["an MP4", ftyp("isom", ["isom", "iso2", "avc1", "mp41"])],
    ["a QuickTime movie", ftyp("qt  ", ["qt  "])],
    ["an M4V", ftyp("M4V ", ["M4V ", "M4A ", "mp42", "isom"])],
  ])("reads %s as video", (_name, content) => {
    expect(ftypMedia(content)).toBe("video");
  });

  it.each([
    ["an iPhone HEIC", ftyp("heic", ["mif1", "heic"])],
    ["an AVIF", ftyp("avif", ["avif", "mif1", "miaf", "MA1B"])],
    ["an AVIF sequence", ftyp("avis", ["avis", "msf1", "iso8"])],
    ["a HEIF named by a compatible brand only", ftyp("isom", ["isom", "mif1"])],
  ])("reads %s as an image", (_name, content) => {
    expect(ftypMedia(content)).toBe("image");
  });

  it.each([
    ["too small to hold a brand", ftyp("isom", [], 12)],
    ["larger than the file", ftyp("isom", ["isom"], 4096)],
    ["not a whole number of brands", ftyp("isom", ["isom"], 18)],
  ])("refuses a box %s as damaged", (_name, content) => {
    expect(() => ftypMedia(content)).toThrow(ContentRefusal);
  });
});
