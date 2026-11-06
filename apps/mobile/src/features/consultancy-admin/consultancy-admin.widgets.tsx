import { useState, type ReactNode } from "react";

import { Button, Row } from "@ampm/ui";

/**
 * Small shared form widgets for the staff create forms. OptionButtons stands in for a Select (the UI
 * library has none — ui.md): one button per choice, the selected one filled. CreateToggle reveals a
 * create form in place of a "New …" button and hides it again when the form is done.
 */

/** A single-choice button row: the selected value is a filled (primary) button, the rest secondary. */
export function OptionButtons<T extends string>({
  options,
  selected,
  onSelect,
  disabled = false,
}: {
  readonly options: ReadonlyArray<{ readonly value: T; readonly label: string }>;
  readonly selected: T | null;
  readonly onSelect: (value: T) => void;
  readonly disabled?: boolean;
}) {
  return (
    <Row gap={2} wrap>
      {options.map((option) => {
        const isSelected = option.value === selected;
        // The selection must not read by fill colour alone (code.md): a ✓ marks it and the
        // accessibility label states it, so a screen reader announces which choice is active.
        return (
          <Button
            key={option.value}
            size="sm"
            variant={isSelected ? "primary" : "secondary"}
            disabled={disabled}
            accessibilityLabel={isSelected ? `${option.label}, selected` : option.label}
            onPress={() => onSelect(option.value)}
          >
            {isSelected ? `✓ ${option.label}` : option.label}
          </Button>
        );
      })}
    </Row>
  );
}

/** A "New …" button that swaps itself for the create form it wraps; `done` hides the form again. */
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
      <Button variant="secondary" size="sm" onPress={() => setOpen(true)}>
        {label}
      </Button>
    </Row>
  );
}
