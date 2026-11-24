import { Injectable } from "@nestjs/common";
import sharp, { type Metadata, type SharpOptions } from "sharp";

import { uploadRefusal } from "../common/upload-refusal.js";

/**
 * The image-derivation seam (feature 9.3c; AC-24.1 derivatives, AC-20.4 metadata stripping). Like the
 * storage and scanner ports, business logic depends on this interface, not on a library, so the
 * implementation (sharp today) can be swapped for an off-box job runner without touching the services.
 * StorageModule provides it to every module, so media and documents share one processor (D-187).
 */
export const IMAGE_PROCESSOR = Symbol("IMAGE_PROCESSOR");

/** The largest image, in pixels (width x height), any upload may be (D-187 §4). */
export const MAX_IMAGE_PIXELS = 25_000_000;

/**
 * How every pipeline reads its input (D-187 §4): an image over the pixel limit is refused from its
 * header, before its pixels are decoded, and invalid pixel data aborts the work, while the warnings
 * ordinary camera files raise do not.
 */
export const SHARP_INPUT = {
  limitInputPixels: MAX_IMAGE_PIXELS,
  failOn: "error",
} as const satisfies SharpOptions;

/** The formats a document image is kept in: as uploaded, so its detected type stays true. */
export type DocumentImageFormat = "jpeg" | "png";

export interface ImageProcessor {
  /**
   * A rendition of `input` bounded to `maxEdge` pixels on its longest side (never enlarged), auto-oriented
   * from its EXIF orientation and then STRIPPED of every metadata block — no GPS or device tags survive
   * (AC-20.4). The output keeps the input's image format, so one stored mime type describes every rendition.
   */
  derive(input: Buffer, maxEdge: number): Promise<Buffer>;
  /**
   * `input` re-encoded for keeping as a document (D-187 §3): turned upright from its EXIF orientation,
   * stripped of every metadata block, never downscaled, in the same format (a JPEG at quality 90, a PNG
   * as a PNG, a palette PNG still a palette PNG).
   */
  reencode(input: Buffer, format: DocumentImageFormat): Promise<Buffer>;
}

/**
 * Runs one job at a time, in the order they arrive; a job that fails does not hold up the next.
 *
 * @example
 * const resized = await queue.run(() => sharp(input).resize(400).toBuffer());
 */
export class SerialQueue {
  private last: Promise<unknown> = Promise.resolve();

  run<T>(job: () => Promise<T>): Promise<T> {
    const result = this.last.then(job);
    this.last = result.catch(() => undefined);
    return result;
  }
}

/**
 * The one queue all image work in this process goes through (D-187 §4): media derivatives and document
 * images alike, one image at a time, so concurrent uploads cannot multiply libvips' memory.
 */
export const IMAGE_QUEUE = new SerialQueue();

/**
 * sharp-backed processing (libvips), in-process. libvips' settings are process-wide: its operation cache
 * is off, so no decoded image outlives its job, and each image gets one thread, beside the one-at-a-time
 * queue (D-187 §4).
 */
@Injectable()
export class SharpImageProcessor implements ImageProcessor {
  constructor() {
    sharp.cache(false);
    sharp.concurrency(1);
  }

  derive(input: Buffer, maxEdge: number): Promise<Buffer> {
    return IMAGE_QUEUE.run(async () => {
      await withinPixelLimit(input);
      // .rotate() bakes in the EXIF orientation first, so dropping metadata next cannot mis-orient the
      // result. sharp copies no EXIF/XMP/ICC unless .withMetadata() is called — which it is not — so the
      // derivative carries no location or device metadata (AC-20.4). No output format is set, so the
      // input format is preserved and the asset's single mime type stays correct for every rendition.
      return sharp(input, SHARP_INPUT)
        .rotate()
        .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
        .toBuffer();
    });
  }

  reencode(input: Buffer, format: DocumentImageFormat): Promise<Buffer> {
    return IMAGE_QUEUE.run(async () => {
      const header = await withinPixelLimit(input);
      const upright = sharp(input, SHARP_INPUT).rotate();
      const encoded =
        format === "jpeg"
          ? upright.jpeg({ quality: 90 })
          : upright.png(header.isPalette ? { palette: true } : {});
      return encoded.toBuffer();
    });
  }
}

/**
 * Reads the image's header, never its pixels, and refuses an image over the pixel limit with D-187's
 * wording, the core refusal `image_too_many_pixels` (a 400 the services pass on as it is). The
 * pipeline's own limit stays as the backstop.
 */
async function withinPixelLimit(input: Buffer): Promise<Metadata> {
  const header = await sharp(input, { ...SHARP_INPUT, limitInputPixels: false }).metadata();
  if ((header.width ?? 0) * (header.height ?? 0) > MAX_IMAGE_PIXELS) {
    throw uploadRefusal("image_too_many_pixels");
  }
  return header;
}
