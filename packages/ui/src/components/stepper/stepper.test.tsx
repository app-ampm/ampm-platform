import { Text } from "react-native";

import { renderWithProviders, screen } from "../../test/render";
import { Stepper, stepStates, type StepperStep } from "./stepper";
import { stepConnectorStyles, stepMarkerStyles, stepperStyles } from "./stepper.styles";

const ENQUIRY: StepperStep[] = [
  { key: "submitted", label: "Submitted" },
  { key: "checking", label: "Checking" },
  { key: "available", label: "Available" },
  { key: "proposal", label: "Proposal shared", detail: "Today" },
  { key: "decision", label: "Your decision" },
];

const hidden = { includeHiddenElements: true } as const;

describe("Stepper", () => {
  it("reads each step as its label and state", async () => {
    await renderWithProviders(<Stepper steps={ENQUIRY} current={3} />);
    expect(screen.getByLabelText("Submitted, done")).toBeOnTheScreen();
    expect(screen.getByLabelText("Available, done")).toBeOnTheScreen();
    expect(screen.getByLabelText("Proposal shared, current step, Today")).toBeOnTheScreen();
    expect(screen.getByLabelText("Your decision, not started")).toBeOnTheScreen();
  });

  it("marks done, current and upcoming steps with their treatments", async () => {
    await renderWithProviders(<Stepper steps={ENQUIRY} current={1} testID="enquiry" />);
    const marker = (key: string) =>
      screen.getByTestId(`enquiry-step-${key}-marker`).props.className;
    expect(marker("submitted")).toContain("bg-highlight");
    expect(marker("checking")).toContain("border-brand");
    expect(marker("available")).toContain("border-primary/26");
  });

  it("treats current past the end as all done and -1 as none started", () => {
    expect(stepStates(ENQUIRY, ENQUIRY.length)).toEqual(Array(5).fill("done"));
    expect(stepStates(ENQUIRY, -1)).toEqual(Array(5).fill("upcoming"));
    expect(stepStates(ENQUIRY, 2)).toEqual(["done", "done", "current", "upcoming", "upcoming"]);
  });

  it("lets a step override the state its position gives it", () => {
    const steps = [{}, { state: "done" as const }, {}, { state: "current" as const }];
    expect(stepStates(steps, 0)).toEqual(["current", "done", "upcoming", "current"]);
  });

  it("uses the caller's state words", async () => {
    await renderWithProviders(
      <Stepper steps={ENQUIRY.slice(0, 2)} current={1} stateLabels={{ done: "erledigt" }} />,
    );
    expect(screen.getByLabelText("Submitted, erledigt")).toBeOnTheScreen();
    expect(screen.getByLabelText("Checking, current step")).toBeOnTheScreen();
  });

  it("draws the detail line and, vertically, the step's content", async () => {
    const steps: StepperStep[] = [
      { key: "hold", label: "Hold placed", detail: "2 Nov 2026" },
      { key: "advance", label: "Advance payment", content: <Text>Pay by 15 Dec</Text> },
    ];
    await renderWithProviders(<Stepper steps={steps} current={1} orientation="vertical" />);
    expect(screen.getByText("2 Nov 2026")).toBeOnTheScreen();
    expect(screen.getByText("Pay by 15 Dec")).toBeOnTheScreen();
    expect(screen.getByLabelText("Advance payment, current step")).toBeOnTheScreen();
  });

  it("hides the vertical markers from screen readers and keeps their states", async () => {
    await renderWithProviders(
      <Stepper steps={ENQUIRY} current={2} orientation="vertical" testID="timeline" />,
    );
    expect(screen.queryByTestId("timeline-step-submitted-marker")).toBeNull();
    const marker = screen.getByTestId("timeline-step-available-marker", hidden);
    expect(marker.props.className).toContain("border-brand");
  });

  it("maps states and orientations to the token classes", () => {
    expect(stepMarkerStyles({ state: "done" })).toContain("bg-highlight");
    expect(stepMarkerStyles({ state: "current" })).toContain("border-2");
    expect(stepMarkerStyles({ state: "upcoming" })).toContain("border-primary/26");
    expect(stepMarkerStyles({})).toContain("rounded-full");
    expect(stepConnectorStyles({ state: "done" })).toContain("bg-highlight");
    expect(stepConnectorStyles({ state: "pending" })).toContain("bg-primary/16");
    expect(stepConnectorStyles({ orientation: "horizontal" })).toContain("h-px");
    expect(stepConnectorStyles({ orientation: "vertical" })).toContain("w-px");
    expect(stepperStyles({ orientation: "horizontal" })).toContain("flex-row");
    expect(stepperStyles({ orientation: "vertical" })).toContain("flex-col");
  });

  it("colours the connectors peacock behind the person", async () => {
    await renderWithProviders(<Stepper steps={ENQUIRY.slice(0, 3)} current={1} testID="s" />);
    const tree = JSON.stringify(screen.toJSON());
    // One done step: its right half and the next step's left half are peacock hairlines.
    expect(tree.match(/h-px flex-1 bg-highlight/g)).toHaveLength(2);
    expect(tree.match(/h-px flex-1 bg-primary\/16/g)).toHaveLength(2);
  });
});
