import { clientAmount } from "@ampm/core";
import { Button, Card, InternalPanel, MoneyText, Row, Stack, Text } from "@ampm/ui";

import { RATE_ITEM_OPTIONS, textError, type ChoiceOption } from "./consultancy-admin.form";
import {
  AmountInput,
  ChoiceChips,
  ChoiceSegments,
  FormInput,
} from "./consultancy-admin.form-widgets";
import {
  clientLinesTotalMinor,
  quantityError,
  type LineDraft,
  type LinePatch,
} from "./proposal-draft";

type Visibility = "client" | "internal";

const VISIBILITY_OPTIONS: ReadonlyArray<ChoiceOption<Visibility>> = [
  { value: "client", label: "Client sees it" },
  { value: "internal", label: "Internal only" },
];

function visibilityOf(clientVisible: boolean | null): Visibility | null {
  if (clientVisible === null) return null;
  return clientVisible ? "client" : "internal";
}

/** A line field's test id: `proposal-line-2-total`. */
const fieldId = (position: number, field: string): string => `proposal-line-${position}-${field}`;

export interface LinesEditorProps {
  readonly lines: readonly LineDraft[];
  readonly disabled: boolean;
  readonly onAdd: () => void;
  readonly onRemove: (key: number) => void;
  readonly onChange: (key: number, patch: LinePatch) => void;
}

/**
 * The proposal's optional lines (TW-28: type, description, quantity, unit amount, total, client
 * visible). A line marked internal only moves into an InternalPanel, since its amounts never reach the
 * client; under the lines, what the client-visible ones add up to, to check the client total against.
 */
export function LinesEditor({ lines, disabled, onAdd, onRemove, onChange }: LinesEditorProps) {
  return (
    <Stack gap={3}>
      <Row gap={2} justify="between">
        <Text variant="label" tone="body">
          Lines
        </Text>
        <Text variant="bodySmall" tone="muted">
          Optional
        </Text>
      </Row>
      {lines.map((line, index) => (
        <LineRow
          key={line.key}
          position={index + 1}
          line={line}
          disabled={disabled}
          onRemove={() => onRemove(line.key)}
          onChange={(patch) => onChange(line.key, patch)}
        />
      ))}
      <ClientLinesTotal lines={lines} />
      <Button variant="secondary" size="sm" icon="plus" disabled={disabled} onPress={onAdd}>
        Add line
      </Button>
    </Stack>
  );
}

interface LineRowProps {
  readonly position: number;
  readonly line: LineDraft;
  readonly disabled: boolean;
  readonly onRemove: () => void;
  readonly onChange: (patch: LinePatch) => void;
}

/** A line nested in the form card: a flat row, or an InternalPanel once it is marked internal only. */
function LineRow(props: LineRowProps) {
  const testID = `proposal-line-${props.position}`;
  if (props.line.clientVisible === false) {
    return (
      <InternalPanel className="rounded" testID={testID}>
        <LineBody {...props} />
      </InternalPanel>
    );
  }
  return (
    <Card tone="flat" padding="sm" testID={testID}>
      <LineBody {...props} />
    </Card>
  );
}

function LineBody({ position, line, disabled, onRemove, onChange }: LineRowProps) {
  return (
    <Stack gap={3}>
      <Row gap={2} justify="between">
        <Text variant="label">{`Line ${position}`}</Text>
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          disabled={disabled}
          accessibilityLabel={`Remove line ${position}`}
          onPress={onRemove}
        >
          Remove
        </Button>
      </Row>
      <ChoiceChips
        label="Item"
        required
        options={RATE_ITEM_OPTIONS}
        selected={line.itemType}
        onSelect={(itemType) => onChange({ itemType })}
        disabled={disabled}
      />
      <LineFields position={position} line={line} onChange={onChange} />
      <ChoiceSegments
        label="Who sees this line"
        required
        options={VISIBILITY_OPTIONS}
        selected={visibilityOf(line.clientVisible)}
        onSelect={(visibility) => onChange({ clientVisible: visibility === "client" })}
        disabled={disabled}
        testID={fieldId(position, "visibility")}
      />
    </Stack>
  );
}

interface LineFieldsProps {
  readonly position: number;
  readonly line: LineDraft;
  readonly onChange: (patch: LinePatch) => void;
}

/** The typed fields of a line: what it is, how many at what unit price, and the line total. */
function LineFields({ position, line, onChange }: LineFieldsProps) {
  return (
    <>
      <FormInput
        label="Description"
        required
        testID={fieldId(position, "description")}
        value={line.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="Deluxe rooms, 2 nights"
        error={textError(line.description, "Describe the line")}
      />
      <LineQuantityAndUnit position={position} line={line} onChange={onChange} />
      <AmountInput
        label="Line total"
        field="line total"
        required
        testID={fieldId(position, "total")}
        value={line.totalAmount}
        onChangeText={(totalAmount) => onChange({ totalAmount })}
        placeholder="720000"
      />
    </>
  );
}

function LineQuantityAndUnit({ position, line, onChange }: LineFieldsProps) {
  return (
    <Row gap={2} align="start">
      <FormInput
        label="Quantity"
        required
        className="flex-1"
        testID={fieldId(position, "quantity")}
        value={line.quantity}
        onChangeText={(quantity) => onChange({ quantity })}
        placeholder="60"
        keyboardType="number-pad"
        error={quantityError(line.quantity)}
      />
      <AmountInput
        label="Unit price"
        field="unit price"
        required
        className="flex-1"
        testID={fieldId(position, "unit")}
        value={line.unitAmount}
        onChangeText={(unitAmount) => onChange({ unitAmount })}
        placeholder="12000"
      />
    </Row>
  );
}

/** The computed client figure: what the client-visible lines add up to, a client amount (MoneyText). */
function ClientLinesTotal({ lines }: { readonly lines: readonly LineDraft[] }) {
  const minor = clientLinesTotalMinor(lines);
  if (minor === null) return null;
  return (
    <Row
      gap={3}
      justify="between"
      className="border-t border-primary/16 pt-3"
      testID="proposal-lines-client-total"
    >
      <Text variant="label" tone="body" className="flex-1">
        Client-visible lines add up to
      </Text>
      <MoneyText amount={clientAmount(minor)} variant="subheading" />
    </Row>
  );
}
