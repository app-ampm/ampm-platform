import type { ReactNode } from "react";
import { View, type ViewProps } from "react-native";

import { uiCopy } from "../../copy";
import { cn } from "../../lib/cn";
import { HorizontalStep, VerticalStep, type StepView } from "./stepper-step";
import {
  stepperStyles,
  type StepConnectorState,
  type StepState,
  type StepperOrientation,
} from "./stepper.styles";

export interface StepperStep {
  /** Stable identity (the status or record id); also names the step's testID. */
  readonly key: string;
  readonly label: string;
  /** A second line under the label: a date, an owner, a due date ("Due 12 Dec 2026"). */
  readonly detail?: string | undefined;
  /**
   * Overrides the state `current` gives this step, for sequences that do not finish in order (booking
   * milestones where a later one is done first, or an overdue one that needs the person now).
   */
  readonly state?: StepState | undefined;
  /** Vertical only: anything under the label, such as an amount, a status chip or the step's actions. */
  readonly content?: ReactNode;
}

/** The words a screen reader adds after each label; defaults to uiCopy.stepper. */
export interface StepperStateLabels {
  readonly done: string;
  readonly current: string;
  readonly upcoming: string;
}

export interface StepperProps extends Omit<ViewProps, "children"> {
  readonly steps: ReadonlyArray<StepperStep>;
  /**
   * The index of the current step: earlier steps are done and later ones upcoming. `steps.length` (or
   * more) means every step is done; -1 means none has started.
   */
  readonly current: number;
  /** `horizontal` (the default) for a status strip, `vertical` for a timeline with details and content. */
  readonly orientation?: StepperOrientation | undefined;
  readonly stateLabels?: Partial<StepperStateLabels> | undefined;
  readonly className?: string;
}

/** Each step's state: its own override, else done before `current`, current at it, upcoming after. */
export function stepStates(
  steps: ReadonlyArray<Pick<StepperStep, "state">>,
  current: number,
): StepState[] {
  const at = Math.floor(current);
  return steps.map((step, index) => {
    if (step.state) return step.state;
    if (index < at) return "done";
    return index === at ? "current" : "upcoming";
  });
}

function connector(state: StepState | undefined): StepConnectorState {
  if (state === undefined) return "none";
  return state === "done" ? "done" : "pending";
}

function stepViews(
  steps: ReadonlyArray<StepperStep>,
  current: number,
  words: StepperStateLabels,
  testID: string | undefined,
): StepView[] {
  const states = stepStates(steps, current);
  return steps.map((step, index) => {
    const state = states[index] ?? "upcoming";
    const spoken = [step.label, words[state], step.detail].filter(Boolean).join(", ");
    return {
      key: step.key,
      label: step.label,
      detail: step.detail,
      content: step.content,
      state,
      stateWord: words[state],
      spoken,
      before: index === 0 ? "none" : connector(states[index - 1]),
      after: index === steps.length - 1 ? "none" : connector(state),
      isLast: index === steps.length - 1,
      testID: testID ? `${testID}-step-${step.key}` : undefined,
    };
  });
}

/**
 * The status stepper of enquiries and requests (submitted → checking → available → proposal shared →
 * decision): done steps peacock with a check, the current step a gold ring, upcoming steps a pearl
 * ring, joined by hairlines that turn peacock behind the person. Each step reads as one element,
 * "Checking, done" or "Proposal shared, current step"; the colour never carries the state alone.
 *
 *   <Stepper
 *     current={3}
 *     steps={[
 *       { key: "submitted", label: "Submitted" },
 *       { key: "checking", label: "Checking" },
 *       { key: "available", label: "Available" },
 *       { key: "proposal", label: "Proposal shared", detail: "Today" },
 *       { key: "decision", label: "Your decision" },
 *     ]}
 *   />
 *   <Stepper orientation="vertical" current={1} steps={milestones} />
 */
export function Stepper({
  steps,
  current,
  orientation = "horizontal",
  stateLabels,
  className,
  testID,
  ...rest
}: StepperProps) {
  const words: StepperStateLabels = { ...uiCopy.stepper, ...stateLabels };
  const views = stepViews(steps, current, words, testID);
  const Step = orientation === "horizontal" ? HorizontalStep : VerticalStep;
  return (
    <View
      accessibilityRole="list"
      className={cn(stepperStyles({ orientation }), className)}
      testID={testID}
      {...rest}
    >
      {views.map((view) => (
        <Step key={view.key} step={view} />
      ))}
    </View>
  );
}
