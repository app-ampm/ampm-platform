/**
 * A CSV the staff picked to import: its text and the file name (for the "chosen file" hint). The text is
 * null when the file is over the import cap: the picker checks the size before reading, so an oversized
 * file never lands in the paste box.
 */
export interface PickedCsv {
  readonly content: string | null;
  readonly name: string;
}

/**
 * Pick one `.csv` file and read its text. The web override (`pick-csv-file.web.ts`) opens a file input;
 * this default (native, and the type-check target) returns null — the staff workspace is the web export,
 * and the screen offers a paste box instead, so the import never fails on a phone.
 */
export function pickCsvFile(): Promise<PickedCsv | null> {
  return Promise.resolve(null);
}
