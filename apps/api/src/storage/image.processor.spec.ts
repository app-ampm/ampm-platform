import { crc32 } from "node:zlib";

import { UPLOAD_REFUSAL_MESSAGES } from "@ampm/core";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppLogger } from "../common/logger.service.js";
import {
  IMAGE_JOB_TIMEOUT_MS,
  IMAGE_QUEUE,
  SerialQueue,
  SHARP_INPUT,
  SharpImageProcessor,
} from "./image.processor.js";

interface LoggedEvent {
  readonly event: string;
  readonly fields: unknown;
}

/** A logger that keeps each event it is given, at any level, in `logged`. */
function recordingLogger(logged: LoggedEvent[] = []): AppLogger {
  const record = (event: string, fields: unknown = {}) => void logged.push({ event, fields });
  return { info: record, warn: record, error: record } as unknown as AppLogger;
}

const flat = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 20, g: 150, b: 90 } } });

/**
 * A PNG whose header claims `width` x `height` over the pixel data of a 4x4 image: reading its header
 * works, decoding its pixels fails. So a refusal that names the pixel limit was decided from the header.
 */
async function claimedPng(width: number, height: number): Promise<Buffer> {
  const png = Buffer.from(await flat(4, 4).png().toBuffer());
  png.writeUInt32BE(width, 16); // IHDR: the signature (8), the chunk length and type (8), then the size
  png.writeUInt32BE(height, 20);
  png.writeUInt32BE(crc32(png.subarray(12, 29)), 29);
  return png;
}

/**
 * The sharp derivation unit (feature 9.3c). A derivative is bounded to the requested longest edge, never
 * enlarged, keeps the source image format, and — the security point (AC-20.4) — carries none of the
 * source's EXIF: no device or location metadata reaches a stored rendition.
 */
describe("SharpImageProcessor", () => {
  const processor = new SharpImageProcessor(recordingLogger());

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

describe("SharpImageProcessor limits (D-187 §4)", () => {
  const processor = new SharpImageProcessor(recordingLogger());

  it("turns libvips' operation cache off and gives each image one thread", () => {
    const { memory, files, items } = sharp.cache();
    expect([memory.max, files.max, items.max]).toEqual([0, 0, 0]);
    expect(sharp.concurrency()).toBe(1);
  });

  it("reads every input under the 25-megapixel limit, failing on errors rather than warnings", () => {
    expect(SHARP_INPUT).toEqual({ limitInputPixels: 25_000_000, failOn: "error" });
  });

  it("refuses an image over 25 megapixels from its header, without decoding its pixels", async () => {
    const message = UPLOAD_REFUSAL_MESSAGES.image_too_many_pixels;
    const refusal = {
      code: "validation_failed",
      status: 400,
      message,
      details: [{ path: "file", message }],
    };
    expect(message).toBe(
      "Images can be at most 25 megapixels: save it as a PDF or a smaller image.",
    );
    const overLimit = await claimedPng(5001, 5000);
    await expect(processor.derive(overLimit, 400)).rejects.toMatchObject(refusal);
    await expect(processor.reencode(overLimit, "png")).rejects.toMatchObject(refusal);
  });

  it("takes an image of exactly 25 megapixels", async () => {
    const atLimit = await flat(5000, 5000).png().toBuffer();
    const meta = await sharp(await processor.reencode(atLimit, "png")).metadata();
    expect([meta.width, meta.height]).toEqual([5000, 5000]);
  });

  it("works through the one process-wide queue, for derivatives and document images alike", async () => {
    const run = vi.spyOn(IMAGE_QUEUE, "run");
    try {
      const png = await flat(8, 8).png().toBuffer();
      await processor.derive(png, 4);
      await processor.reencode(png, "png");
      expect(run).toHaveBeenCalledTimes(2);
    } finally {
      run.mockRestore();
    }
  });
});

describe("SharpImageProcessor.reencode: an image kept as a document (D-187 §3)", () => {
  const processor = new SharpImageProcessor(recordingLogger());

  it("keeps a JPEG a JPEG at quality 90, turned upright, at full size, without its metadata", async () => {
    const source = await flat(3000, 2000)
      .withMetadata({ orientation: 6 }) // stored on its side, shown upright
      .withExif({ IFD0: { Make: "TestCam", Model: "StripMe" } })
      .jpeg()
      .toBuffer();
    const sourceMeta = await sharp(source).metadata();
    expect(sourceMeta.exif).toBeInstanceOf(Buffer); // the test's own guard: there is EXIF to strip
    expect(sourceMeta.orientation).toBe(6);

    const stored = await processor.reencode(source, "jpeg");
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([2000, 3000]); // rotated upright, never downscaled
    expect(meta.exif).toBeUndefined();
    expect(meta.orientation).toBeUndefined();
    expect(stored.equals(await sharp(source).rotate().jpeg({ quality: 90 }).toBuffer())).toBe(true);
  });

  it("keeps a PNG a PNG, and a palette PNG a palette PNG, pixel for pixel", async () => {
    const truecolour = await flat(64, 48).png().toBuffer();
    expect((await sharp(await processor.reencode(truecolour, "png")).metadata()).format).toBe(
      "png",
    );
    const palette = await flat(64, 48).png({ palette: true }).toBuffer();
    const stored = await processor.reencode(palette, "png");
    const meta = await sharp(stored).metadata();
    expect([meta.format, meta.isPalette]).toEqual(["png", true]);
    const pixels = (image: Buffer) => sharp(image).raw().toBuffer();
    expect((await pixels(stored)).equals(await pixels(palette))).toBe(true);
  });

  it("refuses bytes it cannot decode", async () => {
    const broken = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from("not a jpeg"),
    ]);
    await expect(processor.reencode(broken, "jpeg")).rejects.toBeInstanceOf(Error);
  });
});

describe("SerialQueue", () => {
  it("runs one job at a time, in the order they came", async () => {
    const queue = new SerialQueue();
    const log: string[] = [];
    let finishFirst: () => void = () => undefined;
    const firstMayFinish = new Promise<void>((resolve) => (finishFirst = resolve));
    const first = queue.run(async () => {
      log.push("first started");
      await firstMayFinish;
      log.push("first finished");
      return 1;
    });
    const second = queue.run(async () => {
      log.push("second started");
      return 2;
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(log).toEqual(["first started"]);
    finishFirst();
    await expect(Promise.all([first, second])).resolves.toEqual([1, 2]);
    expect(log).toEqual(["first started", "first finished", "second started"]);
  });

  it("goes on to the next job when one fails", async () => {
    const queue = new SerialQueue();
    const failed = queue.run(async () => {
      throw new Error("a broken image");
    });
    const next = queue.run(async () => "next");
    await expect(failed).rejects.toThrow("a broken image");
    await expect(next).resolves.toBe("next");
  });
});

describe("SerialQueue: each job's time limit", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const never = () => new Promise<never>(() => undefined);
  const after =
    <T>(ms: number, value: T) =>
    () =>
      new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

  it("fails a job still running after 60 seconds with a 503, and goes on to the next", async () => {
    vi.useFakeTimers();
    const queue = new SerialQueue();
    const timedOut = vi.fn();
    const stuck = queue.run(never, timedOut);
    const outcome = stuck.catch((error: unknown) => error);
    const next = queue.run(async () => "next");
    await vi.advanceTimersByTimeAsync(IMAGE_JOB_TIMEOUT_MS - 1);
    expect(timedOut).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome).toMatchObject({
      status: 503,
      code: "unavailable",
      message: "The server could not process the image in time. Try again.",
    });
    expect(timedOut).toHaveBeenCalledTimes(1);
    await expect(next).resolves.toBe("next");
    expect(IMAGE_JOB_TIMEOUT_MS).toBe(60_000);
  });

  it("counts the limit from when a job starts, not while it waits its turn", async () => {
    vi.useFakeTimers();
    const queue = new SerialQueue();
    const first = queue.run(after(40_000, "first"));
    const second = queue.run(after(40_000, "second")); // done 80 s after it was queued
    await vi.advanceTimersByTimeAsync(80_000);
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
  });

  it("drops what a job that ran out of time answers later", async () => {
    vi.useFakeTimers();
    const queue = new SerialQueue();
    const late = queue.run(
      () =>
        new Promise<string>((_resolve, reject) =>
          setTimeout(() => reject(new Error("too late")), IMAGE_JOB_TIMEOUT_MS + 1_000),
        ),
    );
    const outcome = late.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(IMAGE_JOB_TIMEOUT_MS + 2_000);
    expect(await outcome).toMatchObject({ status: 503 });
  });
});

describe("SharpImageProcessor: a job past the time limit", () => {
  it("logs image_queue.timeout with what the job was, never what the image holds", async () => {
    const logged: LoggedEvent[] = [];
    const processor = new SharpImageProcessor(recordingLogger(logged));
    const run = vi.spyOn(IMAGE_QUEUE, "run");
    try {
      const png = await flat(8, 8).png().toBuffer();
      await processor.reencode(png, "png");
      run.mock.calls[0]?.[1]?.();
      expect(logged).toEqual([
        {
          event: "image_queue.timeout",
          fields: { job: "reencode", sizeBytes: png.length, timeoutMs: 60_000 },
        },
      ]);
    } finally {
      run.mockRestore();
    }
  });

  it("has libvips stop an image's work at the same limit, so a job left behind ends too", async () => {
    const processor = new SharpImageProcessor(recordingLogger());
    const timeout = vi.spyOn(sharp.prototype, "timeout");
    try {
      const png = await flat(8, 8).png().toBuffer();
      await processor.derive(png, 4);
      await processor.reencode(png, "png");
      expect(timeout.mock.calls).toEqual([[{ seconds: 60 }], [{ seconds: 60 }]]);
    } finally {
      timeout.mockRestore();
    }
  });
});
