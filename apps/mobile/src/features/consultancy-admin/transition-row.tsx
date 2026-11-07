import { Button, Row } from "@ampm/ui";

import { statusWords } from "./consultancy-admin.format";

/**
 * A record's status moves as a row of buttons, shared by the staff sections, each named by the status
 * it moves to ("Confirmed", "Cancelled") unless `label` says otherwise. Callers list the step forward
 * first (confirm, complete, done, send): it is a peacock `highlight`, Peacock Night's confirm action,
 * and the rest (cancel) are secondary, so the screen's one gold action stays free. An empty set (a
 * terminal record) renders nothing. The API still enforces role and legality, so a denied move
 * surfaces as a toast.
 */
export function TransitionRow<S extends string>({
  nexts,
  pending,
  onMove,
  label,
}: {
  readonly nexts: readonly S[];
  readonly pending: boolean;
  readonly onMove: (status: S) => void;
  readonly label?: (status: S) => string;
}) {
  if (nexts.length === 0) return null;
  return (
    <Row gap={2} wrap>
      {nexts.map((status, index) => (
        <Button
          key={status}
          variant={index === 0 ? "highlight" : "secondary"}
          size="sm"
          loading={pending}
          onPress={() => onMove(status)}
        >
          {label ? label(status) : statusWords(status)}
        </Button>
      ))}
    </Row>
  );
}
