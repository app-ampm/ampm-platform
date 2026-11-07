import { cn, textStyles } from "@ampm/ui/styles";

import {
  COMPARISON_MARK_LABELS,
  COMPARISON_ROWS,
  COMPARISON_STAGES,
  type ComparisonRow,
} from "./how-it-works-content";

const COLUMN_HEADER = cn(
  textStyles({ variant: "eyebrow", tone: "muted" }),
  "px-1 pb-3 text-center md:py-5 md:text-xs",
);

const ROW_LABEL = cn(
  textStyles({ variant: "body", tone: "primary" }),
  "col-span-3 text-left font-normal md:py-4.5 md:pr-6 md:text-lg",
);

/** ✓ in a peacock circle with a midnight check, or a pearl 45% dash; screen readers hear the word. */
function ComparisonMark({ isIncluded }: { readonly isIncluded: boolean }) {
  if (!isIncluded) {
    return (
      <span className="inline-flex h-7 items-center">
        <span aria-hidden className={cn(textStyles({ tone: "disabled" }), "text-lg")}>
          —
        </span>
        <span className="sr-only">{COMPARISON_MARK_LABELS.excluded}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-highlight">
      <span
        aria-hidden
        className={textStyles({ variant: "label", tone: "onHighlight", weight: "bold" })}
      >
        ✓
      </span>
      <span className="sr-only">{COMPARISON_MARK_LABELS.included}</span>
    </span>
  );
}

/** The stages across the top. The corner cell stays for screen readers but leaves the phone's grid. */
function ComparisonHead() {
  return (
    <thead role="rowgroup" className="block md:table-header-group">
      <tr role="row" className="grid grid-cols-3 md:table-row">
        <td role="cell" className="sr-only md:not-sr-only md:w-2/5 xl:w-1/3" />
        {COMPARISON_STAGES.map((stage) => (
          <th key={stage} role="columnheader" scope="col" className={COLUMN_HEADER}>
            {stage}
          </th>
        ))}
      </tr>
    </thead>
  );
}

/** One line of the comparison: across the row on a tablet and desktop, label over marks on a phone. */
function ComparisonBodyRow({ row }: { readonly row: ComparisonRow }) {
  return (
    <tr
      role="row"
      className="grid grid-cols-3 gap-y-2.5 border-t border-primary/16 py-4 md:table-row md:py-0"
    >
      <th role="rowheader" scope="row" className={ROW_LABEL}>
        {row.label}
      </th>
      {COMPARISON_STAGES.map((stage, index) => (
        <td key={stage} role="cell" className="text-center md:py-4.5">
          <ComparisonMark isIncluded={row.included[index] === true} />
        </td>
      ))}
    </tr>
  );
}

/**
 * What each stage includes, side by side (W2). A real table with row and column headers; tablets and
 * desktops draw it as the mock does (the label column a third from 1280, two fifths below that so the
 * labels keep to a line, the stages sharing the rest), and a phone gives each row's label the full
 * width with its three marks beneath the stage names. The roles are spelled out because the phone
 * layout turns the rows into grids, and some browsers drop a table's own semantics once its parts
 * are no longer displayed as a table.
 */
export function ComparisonTable({ labelledBy }: { readonly labelledBy: string }) {
  return (
    <table
      role="table"
      aria-labelledby={labelledBy}
      className="block w-full md:table md:table-fixed"
    >
      <ComparisonHead />
      <tbody role="rowgroup" className="block md:table-row-group">
        {COMPARISON_ROWS.map((row) => (
          <ComparisonBodyRow key={row.label} row={row} />
        ))}
      </tbody>
    </table>
  );
}
