import type { SubscriptionReportRow } from "@ampm/core";
import { Button } from "@ampm/ui";

export interface FinanceActionsProps {
  /** Super Admin and Finance export the report (§5.16); Sales may only run it. */
  readonly canExport: boolean;
  readonly exporting: boolean;
  readonly onExport: () => void;
  /** On the Awaiting payment tab, to whoever may record a payment (D-125). */
  readonly canRecord: boolean;
  /** The awaiting subscription picked in the table, which Record payment acts on. */
  readonly selected: SubscriptionReportRow | undefined;
  readonly onRecord: (row: SubscriptionReportRow) => void;
}

/** The gold Record payment, acting on the awaiting subscription picked in the table. */
function RecordAction({ selected, onRecord }: Pick<FinanceActionsProps, "selected" | "onRecord">) {
  return (
    <Button
      size="sm"
      disabled={!selected}
      onPress={() => {
        if (selected) onRecord(selected);
      }}
      accessibilityHint={
        selected ? `Records a payment for ${selected.accountName}` : "Pick a subscription first"
      }
      testID="finance-record-payment"
    >
      Record payment
    </Button>
  );
}

/**
 * T11's header actions: Export, outlined, then the gold Record payment, at the header's right from 768
 * and wrapping under the title on a phone. Either may be absent for the role or the tab.
 */
export function FinanceActions({
  canExport,
  exporting,
  onExport,
  canRecord,
  selected,
  onRecord,
}: FinanceActionsProps) {
  if (!canExport && !canRecord) return null;
  return (
    <>
      {canExport ? (
        <Button
          variant="secondary"
          size="sm"
          icon="download"
          loading={exporting}
          onPress={onExport}
          testID="finance-export"
        >
          Export
        </Button>
      ) : null}
      {canRecord ? <RecordAction selected={selected} onRecord={onRecord} /> : null}
    </>
  );
}
