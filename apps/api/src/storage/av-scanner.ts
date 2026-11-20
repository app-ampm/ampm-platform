/**
 * The antivirus scan seam (feature 9.3, AC-20.3), shared by every upload path — gallery media and
 * documents (D-132) — so it lives beside the storage port rather than in one module. An uploaded object is
 * never downloadable until a scan passes. StorageModule picks the scanner from AV_PROVIDER: the ClamAV
 * adapter (clamav-scanner.ts) in production, where env.ts refuses the stub below.
 */
export interface AvScanner {
  /**
   * `clean` only when the scanner reports the bytes safe; `rejected` when it finds a threat. When no
   * verdict can be had (the scanner is down, slow or answers anything else) it throws instead, before the
   * caller stores anything, so the upload fails and can be retried: never `clean` on doubt (fail closed).
   */
  scan(bytes: Buffer): Promise<"clean" | "rejected">;
}

export const AV_SCANNER = Symbol("AV_SCANNER");

/** The EICAR antivirus test signature — the standard, harmless marker a scanner must flag (AC-20.3). */
const EICAR_SIGNATURE = Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");

/**
 * Development, tests and CI: flags the EICAR marker anywhere in the bytes, so a test can hide it inside a
 * valid JPEG or PDF and exercise the quarantine path without a daemon. Real ClamAV is stricter: it flags
 * the EICAR file only at the start of a file or as a PDF stream object. Refused in production by env.ts.
 */
export class StubAvScanner implements AvScanner {
  async scan(bytes: Buffer): Promise<"clean" | "rejected"> {
    return bytes.includes(EICAR_SIGNATURE) ? "rejected" : "clean";
  }
}
