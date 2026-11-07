import { useState, type ReactNode } from "react";

import { Button, Row } from "@ampm/ui";

/**
 * A "New …" button that swaps itself for the create form it wraps; `done` hides the form again. The
 * button is secondary with a plus, so the screen's one gold action stays with its next step.
 *
 *   <CreateToggle label="New site visit">
 *     {(done) => <VisitCreateForm enquiryId={enquiryId} onDone={done} />}
 *   </CreateToggle>
 */
export function CreateToggle({
  label,
  children,
}: {
  readonly label: string;
  readonly children: (done: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (open) return <>{children(() => setOpen(false))}</>;
  return (
    <Row justify="start">
      <Button variant="secondary" size="sm" icon="plus" onPress={() => setOpen(true)}>
        {label}
      </Button>
    </Row>
  );
}
