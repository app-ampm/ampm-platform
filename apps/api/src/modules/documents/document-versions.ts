/*
 * How an owner's documents form versions (data-model §16, D-187 §6). A replacement is a new row that
 * names the version it follows in `previous_version_id`, so the rows of one owner form chains: the row
 * no other row follows is the live document, and the rows behind it are its earlier versions. Pure, so
 * the service and its tests share it.
 */

/** What chaining needs of a document row. */
export interface VersionLink {
  readonly id: string;
  readonly previousVersionId: string | null;
  readonly createdAt: Date;
}

/** A live document: its latest version and the versions it replaced, newest first. */
export interface VersionedDocument<Row extends VersionLink = VersionLink> {
  readonly latest: Row;
  readonly earlier: readonly Row[];
}

const newestFirst = (a: VersionLink, b: VersionLink): number =>
  b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * The live documents among `rows`, newest first, each with its earlier versions. A chain stops at a
 * version missing from `rows` (removed, or another owner's), and no row is listed twice: should two
 * rows follow the same version, the newer one keeps it.
 *
 * @example
 * versionChains([v1, v2]); // [{ latest: v2, earlier: [v1] }] when v2 follows v1
 */
export function versionChains<Row extends VersionLink>(
  rows: readonly Row[],
): VersionedDocument<Row>[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const followed = new Set(rows.map((row) => row.previousVersionId));
  const claimed = new Set<string>();
  return rows
    .filter((row) => !followed.has(row.id))
    .sort(newestFirst)
    .map((latest) => {
      const earlier: Row[] = [];
      let next = latest.previousVersionId ? byId.get(latest.previousVersionId) : undefined;
      while (next && !claimed.has(next.id)) {
        claimed.add(next.id);
        earlier.push(next);
        next = next.previousVersionId ? byId.get(next.previousVersionId) : undefined;
      }
      return { latest, earlier };
    });
}
