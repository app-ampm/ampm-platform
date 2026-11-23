import { useToast } from "@ampm/ui";

import { downloadCsv } from "../admin/download-csv";

/**
 * Save CSV text as a file: the web workspace downloads it (the shared `downloadCsv`); a phone or tablet
 * build cannot save one, so it says where to download it instead.
 *
 *   const download = useCsvDownload();
 *   download("hotels-import-template.csv", importTemplateCsv());
 */
export function useCsvDownload(): (filename: string, csv: string) => void {
  const toast = useToast();
  return (filename, csv) => {
    if (!downloadCsv(filename, csv)) {
      toast.show({ title: "Download from the web workspace", tone: "info" });
    }
  };
}
