import { statfs } from "node:fs/promises";
import { resolve } from "node:path";

import { Injectable } from "@nestjs/common";

/** Free and total bytes of the filesystem that holds a directory. */
export interface DiskSpace {
  readonly freeBytes: number;
  readonly totalBytes: number;
}

/**
 * Reads the filesystem behind a directory with statfs. Free is what an unprivileged writer may use
 * (`bavail`: the blocks reserved for root do not count), total is the filesystem's size.
 *
 * @example
 * const { freeBytes } = await probe.measure("/data/storage");
 */
@Injectable()
export class DiskSpaceProbe {
  async measure(dir: string): Promise<DiskSpace> {
    const stats = await statfs(resolve(dir));
    return { freeBytes: stats.bavail * stats.bsize, totalBytes: stats.blocks * stats.bsize };
  }
}
