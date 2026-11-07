import type { ReactNode } from "react";
import { View } from "react-native";

import { cn } from "../../lib/cn";
import { Icon } from "../icon";
import { Text } from "../text";
import {
  stepConnectorStyles,
  stepCurrentDotStyles,
  stepLabelTone,
  stepMarkerStyles,
  type StepConnectorState,
  type StepState,
} from "./stepper.styles";

/** What one step draws, worked out by the Stepper from its position and `current`. */
export interface StepView {
  readonly key: string;
  readonly label: string;
  readonly detail: string | undefined;
  readonly content: ReactNode;
  readonly state: StepState;
  /** "done", "current step", "not started": what the marker's colour and shape show. */
  readonly stateWord: string;
  /** "Submitted, done, 4 Nov": the label, the state word and the detail, read as one element. */
  readonly spoken: string;
  /** The connector before the marker (horizontal only) and after it. */
  readonly before: StepConnectorState;
  readonly after: StepConnectorState;
  readonly isLast: boolean;
  readonly testID: string | undefined;
}

function StepMarker({ state, testID }: { state: StepState; testID: string | undefined }) {
  return (
    <View className={stepMarkerStyles({ state })} testID={testID}>
      {state === "done" ? <Icon name="check" size="sm" tone="onHighlight" /> : null}
      {state === "current" ? <View className={stepCurrentDotStyles} /> : null}
    </View>
  );
}

/**
 * The step's text. On the web the state word follows the label as visually hidden text: there the
 * step is a list item whose words are what a screen reader reads (a label on a plain element is not),
 * so the state never rests on the marker's colour. Native reads the step's accessibilityLabel instead.
 */
function StepText({ step, centred }: { step: StepView; centred: boolean }) {
  const align = centred ? "center" : "left";
  // Horizontal steps share a row, so their labels are the mocks' 11–12 semibold (D8), not the 13 label:
  // single-word labels ("Implemented") then fit a narrow column instead of running into the next.
  return (
    <>
      <Text
        variant={centred ? "caption" : "label"}
        weight="semibold"
        tone={stepLabelTone[step.state]}
        align={align}
      >
        {step.label}
      </Text>
      <Text className="native:hidden web:sr-only">{`, ${step.stateWord}`}</Text>
      {step.detail ? (
        <Text variant="caption" align={align}>
          {step.detail}
        </Text>
      ) : null}
    </>
  );
}

/**
 * A column of the horizontal stepper: connectors either side of the marker, the text under it. One
 * element read as its label, state and detail; a list item of the Stepper's list.
 */
export function HorizontalStep({ step }: { step: StepView }) {
  const marker = step.testID ? `${step.testID}-marker` : undefined;
  return (
    <View
      role="listitem"
      accessible
      accessibilityLabel={step.spoken}
      className="flex flex-1 flex-col items-center gap-2"
      testID={step.testID}
    >
      <View className="flex w-full flex-row items-center gap-1">
        <View className={stepConnectorStyles({ orientation: "horizontal", state: step.before })} />
        <StepMarker state={step.state} testID={marker} />
        <View className={stepConnectorStyles({ orientation: "horizontal", state: step.after })} />
      </View>
      <View className="flex flex-col items-center gap-0.5 px-1">
        <StepText step={step} centred />
      </View>
    </View>
  );
}

/**
 * A row of the vertical stepper: the marker and the line down to the next step on the left (drawing
 * only, hidden from screen readers), the text and any extra content on the right. The text is the
 * accessible element, so buttons in `content` stay reachable on their own.
 */
export function VerticalStep({ step }: { step: StepView }) {
  const marker = step.testID ? `${step.testID}-marker` : undefined;
  return (
    <View role="listitem" className="flex flex-row gap-3" testID={step.testID}>
      <View
        className="flex flex-col items-center"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        <StepMarker state={step.state} testID={marker} />
        {step.isLast ? null : (
          <View className={stepConnectorStyles({ orientation: "vertical", state: step.after })} />
        )}
      </View>
      <View className={cn("flex flex-1 flex-col gap-2", !step.isLast && "pb-5")}>
        <View
          accessible
          accessibilityLabel={step.spoken}
          className="flex min-h-5.5 flex-col justify-center gap-0.5"
        >
          <StepText step={step} centred={false} />
        </View>
        {step.content}
      </View>
    </View>
  );
}
