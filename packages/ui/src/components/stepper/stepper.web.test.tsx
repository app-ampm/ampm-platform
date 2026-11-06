import { Text } from "react-native";

import { allByRole, byRole, renderOnWeb } from "../../test/web";
import { Stepper, type StepperStep } from "./stepper";

const ENQUIRY: StepperStep[] = [
  { key: "submitted", label: "Submitted" },
  { key: "checking", label: "Checking", detail: "4 Nov" },
  { key: "proposal", label: "Proposal shared" },
];

// react-native-web renders a step as a plain element, whose label screen readers ignore: on the web
// the steps are list items and the state word is part of their text, so the colour never carries it.
describe("Stepper on the web", () => {
  it("is a list of steps whose text says each state", async () => {
    const { container } = await renderOnWeb(<Stepper steps={ENQUIRY} current={1} />);
    expect(byRole(container, "list").tagName).toBe("UL");
    const steps = allByRole(container, "listitem");
    expect(steps.map((step) => step.tagName)).toEqual(["LI", "LI", "LI"]);
    expect(steps.map((step) => step.textContent)).toEqual([
      "Submitted, done",
      "Checking, current step4 Nov",
      "Proposal shared, not started",
    ]);
  });

  it("keeps the vertical markers out of the reading", async () => {
    const steps: StepperStep[] = [
      { key: "hold", label: "Hold placed", detail: "2 Nov 2026" },
      { key: "advance", label: "Advance payment", content: <Text>Pay by 15 Dec</Text> },
    ];
    const { container } = await renderOnWeb(
      <Stepper steps={steps} current={1} orientation="vertical" testID="timeline" />,
    );
    const marker = container.querySelector('[data-testid="timeline-step-hold-marker"]');
    expect(marker?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(allByRole(container, "listitem")[1]?.textContent).toContain(
      "Advance payment, current step",
    );
  });
});
