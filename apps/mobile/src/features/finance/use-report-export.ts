import { useSubscriptionReportExport } from "@ampm/api-client";
import type { SubscriptionStatus } from "@ampm/core";
import { useToast, type ToastOptions } from "@ampm/ui";

import { downloadCsv } from "../admin/download-csv";
import { subscriptionReportCsv } from "./finance.csv";
import type { FinanceTab } from "./finance.format";

/** The file a tab's export saves as: "subscriptions-awaiting-payment.csv". */
const FILE_NAME: Record<FinanceTab, string> = {
  awaiting: "subscriptions-awaiting-payment.csv",
  active: "subscriptions-active.csv",
  all: "subscriptions.csv",
};

/** The toast after an export: saved (noting a truncation), or where to export from on a device. */
function exportToast(saved: boolean, rowCount: number, truncated: boolean): ToastOptions {
  if (!saved) return { title: "Export from the web workspace", tone: "info" };
  const noun = rowCount === 1 ? "subscription" : "subscriptions";
  const title = truncated
    ? `Exported the first ${rowCount} ${noun}`
    : `Exported ${rowCount} ${noun}`;
  return { title, tone: "success" };
}

/**
 * Export the tab's subscriptions as a CSV (§5.16: Super Admin and Finance; the server audits it). The
 * file is saved on the web workspace; a phone build says to export from there.
 *
 *   const report = useReportExport();
 *   report.run("awaiting", "pending_payment");
 */
export function useReportExport() {
  const toast = useToast();
  const reportExport = useSubscriptionReportExport();
  const run = (tab: FinanceTab, status: SubscriptionStatus | undefined): void => {
    if (reportExport.isPending) return;
    reportExport.mutate(
      { status },
      {
        onSuccess: (snapshot) => {
          const saved = downloadCsv(FILE_NAME[tab], subscriptionReportCsv(snapshot.rows));
          toast.show(exportToast(saved, snapshot.rowCount, snapshot.truncated));
        },
        onError: () => toast.show({ title: "Could not export the subscriptions", tone: "danger" }),
      },
    );
  };
  return { run, exporting: reportExport.isPending };
}
