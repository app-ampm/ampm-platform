import { Button, Row } from "@ampm/ui";

/**
 * A row of status-transition buttons shared by the staff sections. An empty set (a terminal record)
 * renders nothing. The API still enforces role + legality, so a denied move surfaces as a toast.
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
      {nexts.map((status) => (
        <Button
          key={status}
          variant="secondary"
          size="sm"
          loading={pending}
          onPress={() => onMove(status)}
        >
          {label ? label(status) : status.replace(/_/g, " ")}
        </Button>
      ))}
    </Row>
  );
}
