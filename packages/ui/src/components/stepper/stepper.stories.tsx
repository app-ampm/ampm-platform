import { defineStories } from "../../stories/define";
import { Button } from "../button";
import { Text } from "../text";
import { Stepper, type StepperStep } from "./stepper";

const ENQUIRY: StepperStep[] = [
  { key: "submitted", label: "Submitted" },
  { key: "checking", label: "Checking" },
  { key: "available", label: "Available" },
  { key: "proposal", label: "Proposal shared" },
  { key: "decision", label: "Your decision" },
];

const REQUEST: StepperStep[] = [
  { key: "submitted", label: "Submitted", detail: "3 Nov" },
  { key: "review", label: "Under review", detail: "Since 4 Nov" },
  { key: "accepted", label: "Accepted" },
  { key: "implemented", label: "Implemented" },
  { key: "closed", label: "Closed" },
];

const MILESTONES: StepperStep[] = [
  { key: "hold", label: "Hold placed", detail: "2 Nov 2026" },
  { key: "contract", label: "Contract signed", detail: "9 Nov 2026" },
  {
    key: "advance",
    label: "Advance payment",
    detail: "Due 15 Dec 2026",
    content: (
      <Text variant="data" tone="body">
        ₹9,50,000
      </Text>
    ),
  },
  { key: "rooming", label: "Rooming list", detail: "Due 10 Jan 2027" },
  { key: "balance", label: "Balance due", detail: "Due 1 Feb 2027" },
];

export const stories = defineStories({
  title: "Stepper",
  stories: [
    {
      name: "Enquiry: proposal shared",
      render: () => <Stepper steps={ENQUIRY} current={3} />,
    },
    {
      name: "Request: under review, with dates",
      render: () => <Stepper steps={REQUEST} current={1} />,
    },
    {
      name: "Vertical: booking milestones",
      render: () => <Stepper steps={MILESTONES} current={2} orientation="vertical" />,
    },
    {
      name: "Vertical: a step's own actions",
      render: () => (
        <Stepper
          orientation="vertical"
          current={1}
          steps={[
            { key: "proposed", label: "Visit proposed", detail: "Lakeside lawn, 12 Dec" },
            {
              key: "confirmed",
              label: "Confirm the visit",
              detail: "The hotel holds the slot until Friday",
              content: (
                <Button variant="secondary" size="sm" onPress={() => undefined}>
                  Confirm
                </Button>
              ),
            },
            { key: "completed", label: "Visit completed" },
          ]}
        />
      ),
    },
    {
      name: "Out of order: per-step states",
      render: () => (
        <Stepper
          orientation="vertical"
          current={0}
          steps={[
            { key: "hold", label: "Hold placed", state: "done" },
            { key: "contract", label: "Contract signed", detail: "Overdue", state: "current" },
            { key: "advance", label: "Advance payment", state: "done" },
            { key: "balance", label: "Balance due" },
          ]}
        />
      ),
    },
    {
      name: "All done and not started",
      render: () => (
        <>
          <Stepper steps={ENQUIRY} current={ENQUIRY.length} />
          <Stepper steps={ENQUIRY} current={-1} className="mt-6" />
        </>
      ),
    },
  ],
});
