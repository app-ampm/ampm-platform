import { useRouter } from "expo-router";

import { Button, SegmentedControl } from "@ampm/ui";

/** The pipeline's two views from 768 (T2): stage columns, or rows. */
export type PipelineView = "board" | "list";

const VIEW_OPTIONS = [
  { value: "board", label: "Board" },
  { value: "list", label: "List" },
] as const;

const isPipelineView = (value: string): value is PipelineView =>
  VIEW_OPTIONS.some((option) => option.value === value);

export interface PipelineActionsProps {
  /** The view picked, or null on a phone, which reads the list alone and shows no switch. */
  readonly view: PipelineView | null;
  readonly onView: (view: PipelineView) => void;
  /** Only Sales and the Super Admin hold the funnel report key, so only they get its link. */
  readonly canRunFunnel: boolean;
}

/**
 * The pipeline header's actions (T2): the Board / List switch from 768, then the Funnel report and the
 * Clients list. They sit at the right of the header and wrap under the title on a phone, inside its edge.
 * T2's gold New lead waits for a staff create flow (leads arrive from the website's enquiry form).
 *
 *   <ScreenHeader title="Pipeline" actions={<PipelineActions view="board" onView={setView} canRunFunnel />} />
 */
export function PipelineActions({ view, onView, canRunFunnel }: PipelineActionsProps) {
  const router = useRouter();
  return (
    <>
      {view ? (
        <SegmentedControl
          size="sm"
          options={VIEW_OPTIONS}
          value={view}
          onChange={(next) => {
            if (isPipelineView(next)) onView(next);
          }}
          accessibilityLabel="Pipeline view"
          testID="leads-view"
        />
      ) : null}
      {canRunFunnel ? (
        <Button
          variant="secondary"
          size="sm"
          icon="filter"
          onPress={() => router.push("/leads/funnel")}
          testID="leads-funnel-link"
        >
          Funnel
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="sm"
        icon="briefcase"
        onPress={() => router.push("/leads/accounts")}
        testID="leads-clients-link"
      >
        Clients
      </Button>
    </>
  );
}
