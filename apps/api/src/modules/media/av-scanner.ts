/**
 * The antivirus scan seam (feature 9.3, AC-20.3). An uploaded object is never downloadable until a scan
 * passes — fail-closed: anything not provably clean is `rejected`. This sprint ships a stub that detects
 * the industry-standard EICAR test string; a real scanner is a later config swap (the appendix), and
 * production media is already gated by the storage prod guard until then, so the stub never runs live.
 */
export interface AvScanner {
  /** Returns `clean` only when the bytes are provably safe; any threat or uncertainty is `rejected`. */
  scan(bytes: Buffer): Promise<"clean" | "rejected">;
}

export const AV_SCANNER = Symbol("AV_SCANNER");

/** The EICAR antivirus test signature — the standard, harmless marker a scanner must flag (AC-20.3). */
const EICAR_SIGNATURE = Buffer.from("EICAR-STANDARD-ANTIVIRUS-TEST-FILE");

export class StubAvScanner implements AvScanner {
  async scan(bytes: Buffer): Promise<"clean" | "rejected"> {
    return bytes.includes(EICAR_SIGNATURE) ? "rejected" : "clean";
  }
}
