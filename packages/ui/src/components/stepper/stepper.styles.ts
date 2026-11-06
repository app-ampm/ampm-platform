import { variants, type VariantProps } from "../../lib/variants";

/**
 * Peacock Night's status stepper (enquiries, requests, booking milestones): done steps are a peacock
 * dot with a midnight check, the current step a gold ring around a gold dot, upcoming steps a pearl 26%
 * ring; connectors are pearl 16%, peacock once the step before them is done. The website can reuse the
 * recipes on DOM elements, so every flex recipe also sets `flex`.
 */
export const stepMarkerStyles = variants(
  "flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full",
  {
    variants: {
      state: {
        done: "bg-highlight",
        current: "border-2 border-brand",
        upcoming: "border border-primary/26",
      },
    },
    defaultVariants: { state: "upcoming" },
  },
);

export type StepMarkerStyleProps = VariantProps<typeof stepMarkerStyles>;
export type StepState = NonNullable<StepMarkerStyleProps["state"]>;

/** The gold dot inside the current step's ring. */
export const stepCurrentDotStyles = "h-2 w-2 rounded-full bg-brand";

/**
 * A connector between two markers: a hairline across (horizontal) or down (vertical). `none` keeps
 * the space but draws nothing, so the first and last markers of a horizontal stepper stay centred.
 */
export const stepConnectorStyles = variants("", {
  variants: {
    orientation: { horizontal: "h-px flex-1", vertical: "my-1 w-px flex-1" },
    state: { done: "bg-highlight", pending: "bg-primary/16", none: "bg-transparent" },
  },
  defaultVariants: { orientation: "horizontal", state: "pending" },
});

export type StepConnectorStyleProps = VariantProps<typeof stepConnectorStyles>;
export type StepConnectorState = NonNullable<StepConnectorStyleProps["state"]>;

/** The container: a row of equal columns, or a column of rows. */
export const stepperStyles = variants("flex w-full", {
  variants: {
    orientation: { horizontal: "flex-row items-start", vertical: "flex-col" },
  },
  defaultVariants: { orientation: "horizontal" },
});

export type StepperStyleProps = VariantProps<typeof stepperStyles>;
export type StepperOrientation = NonNullable<StepperStyleProps["orientation"]>;

/** Label strength by state: the current step in pearl, done steps pearl 80%, upcoming pearl 58%. */
export const stepLabelTone = {
  done: "body",
  current: "primary",
  upcoming: "muted",
} as const satisfies Record<StepState, "body" | "primary" | "muted">;
