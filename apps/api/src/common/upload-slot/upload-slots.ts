/** How many uploads one principal may have in flight on one API process (D-187). */
export const UPLOAD_SLOTS_PER_PRINCIPAL = 2;

/** How many uploads one API process reads at once, whoever sends them (D-187). */
export const UPLOAD_SLOTS_PER_PROCESS = 4;

/** Gives one slot back; calling it again does nothing. */
export type ReleaseSlot = () => void;

/**
 * The uploads this API process is reading (D-187 §1), held in memory: at most two per owner (a signed-in
 * principal, or a client network) and four in all, so concurrent uploads cannot pile up request bodies
 * in memory. UploadSlotInterceptor takes a slot after the guards, before any byte of the body is read,
 * and gives it back once the handler's work ends. One instance per application (PlatformModule).
 *
 * @example
 * const release = slots.tryTake("user:0192f1a0-…");
 * if (!release) throw errors.unavailable("The server is busy with other uploads. Try again in 5 seconds.");
 * return next.handle().pipe(finalize(release));
 */
export class UploadSlots {
  private readonly held = new Map<string, number>();
  private total = 0;

  /** Takes a slot for this owner; null when the owner or the process has none free. */
  tryTake(owner: string): ReleaseSlot | null {
    const owned = this.held.get(owner) ?? 0;
    if (owned >= UPLOAD_SLOTS_PER_PRINCIPAL || this.total >= UPLOAD_SLOTS_PER_PROCESS) return null;
    this.held.set(owner, owned + 1);
    this.total += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.giveBack(owner);
    };
  }

  /** The slots held now: by one owner, or by the whole process. */
  inUse(owner?: string): number {
    return owner === undefined ? this.total : (this.held.get(owner) ?? 0);
  }

  private giveBack(owner: string): void {
    const owned = (this.held.get(owner) ?? 1) - 1;
    if (owned > 0) this.held.set(owner, owned);
    else this.held.delete(owner);
    this.total -= 1;
  }
}
