/**
 * Trigger a browser download of CSV text (staff workspace = the Expo web export). A Blob + a transient
 * object URL on a hidden anchor; the URL is revoked after the click. Returns true.
 */
export function downloadCsv(filename: string, csv: string): boolean {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Defer the revoke so WebKit/Firefox can start the download before the URL is invalidated.
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}
