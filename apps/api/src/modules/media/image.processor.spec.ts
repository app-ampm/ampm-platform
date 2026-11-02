import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { SharpImageProcessor } from "./image.processor.js";

/**
 * The sharp derivation unit (feature 9.3c). A derivative is bounded to the requested longest edge, never
 * enlarged, keeps the source image format, and — the security point (AC-20.4) — carries none of the
 * source's EXIF: no device or location metadata reaches a stored rendition.
 */
describe("SharpImageProcessor", () => {
  const processor = new SharpImageProcessor();

  it("bounds the longest edge and strips image metadata (AC-24.1, AC-20.4)", async () => {
    const source = await sharp({
      create: { width: 2000, height: 1000, channels: 3, background: { r: 20, g: 150, b: 90 } },
    })
      .withExif({ IFD0: { Make: "TestCam", Model: "StripMe" } })
      .jpeg()
      .toBuffer();
    // Guard the test itself: the source really carries EXIF, so stripping it is a real assertion.
    expect((await sharp(source).metadata()).exif).toBeInstanceOf(Buffer);

    const web = await processor.derive(source, 400);
    const meta = await sharp(web).metadata();
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(400); // 2000x1000 scales to 400x200
    expect(meta.height).toBe(200);
    expect(meta.format).toBe("jpeg"); // source format preserved, so one mime type fits every rendition
    expect(meta.exif).toBeUndefined(); // no device or location metadata survives
  });

  it("preserves a PNG as a PNG", async () => {
    const source = await sharp({
      create: { width: 10, height: 10, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    expect((await sharp(await processor.derive(source, 400)).metadata()).format).toBe("png");
  });

  it("never enlarges an image smaller than the target edge", async () => {
    const source = await sharp({
      create: { width: 100, height: 80, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer();
    const meta = await sharp(await processor.derive(source, 400)).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(80);
  });
});
