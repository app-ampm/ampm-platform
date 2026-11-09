import type { PickedCsv } from "./pick-csv-file";

export type { PickedCsv } from "./pick-csv-file";

/**
 * Pick one `.csv` on the web through a hidden file input and read its text (the staff workspace is the
 * Expo web export). Resolves with the file's text and name, or null if none was picked. The input is
 * clicked inside the caller's press handler so the browser treats it as a user gesture.
 */
export function pickCsvFile(): Promise<PickedCsv | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      if (!file) {
        resolve(null);
        return;
      }
      void file.text().then((content) => resolve({ content, name: file.name }));
    };
    input.click();
  });
}
