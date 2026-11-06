import { Injectable } from "@nestjs/common";
import sharp from "sharp";

/**
 * The image-derivation seam (feature 9.3c; AC-24.1 derivatives, AC-20.4 metadata stripping). Like the
 * storage and scanner ports, business logic depends on this interface, not on a library, so the
 * implementation (sharp today) can be swapped for an off-box job runner without touching the service.
 */
export const IMAGE_PROCESSOR = Symbol("IMAGE_PROCESSOR");

export interface ImageProcessor {
  /**
   * A rendition of `input` bounded to `maxEdge` pixels on its longest side (never enlarged), auto-oriented
   * from its EXIF orientation and then STRIPPED of every metadata block — no GPS or device tags survive
   * (AC-20.4). The output keeps the input's image format, so one stored mime type describes every rendition.
   */
  derive(input: Buffer, maxEdge: number): Promise<Buffer>;
}

/** sharp-backed derivation (libvips). Runs in-process this sprint; a 25 MiB ceiling bounds the work. */
@Injectable()
export class SharpImageProcessor implements ImageProcessor {
  async derive(input: Buffer, maxEdge: number): Promise<Buffer> {
    // .rotate() bakes in the EXIF orientation first, so dropping metadata next cannot mis-orient the
    // result. sharp copies no EXIF/XMP/ICC unless .withMetadata() is called — which it is not — so the
    // derivative carries no location or device metadata (AC-20.4). No output format is set, so the
    // input format is preserved and the asset's single mime type stays correct for every rendition.
    return sharp(input)
      .rotate()
      .resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true })
      .toBuffer();
  }
}
