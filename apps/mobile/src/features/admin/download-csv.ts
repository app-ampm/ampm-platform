/**
 * Download CSV text as a file. This default (native, and the type-check target) cannot save a file —
 * the staff workspace is the web export — so it returns false and the caller guides the user to the
 * web. The web override (`download-csv.web.ts`) triggers a real browser download.
 */
export function downloadCsv(_filename: string, _csv: string): boolean {
  return false;
}
