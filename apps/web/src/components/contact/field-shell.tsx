import type { ReactNode } from "react";

import { cn, fieldLabelStyles, textStyles } from "@ampm/ui/styles";

import { FieldMessage, type FieldMessageOptions } from "./field-message";

export interface FieldShellProps extends FieldMessageOptions {
  /** The control's id: the label points at it and the error and help lines are named after it. */
  readonly id: string;
  readonly label: string;
  /** A quiet word after the label, in pearl 58% ("Email · optional"). */
  readonly optionalText?: string | undefined;
  /** Placement in the form's grid. */
  readonly className?: string | undefined;
  /** The control in its frame. */
  readonly children: ReactNode;
}

/**
 * A field of the enquiry form (W6): the label in Manrope 600 13, the control in its pill, and under it
 * the gold error or the help line.
 */
export function FieldShell({
  id,
  label,
  optionalText,
  error,
  help,
  className,
  children,
}: FieldShellProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <label htmlFor={id} className={fieldLabelStyles}>
        {label}
        {optionalText ? (
          <span className={textStyles({ variant: "bodySmall", tone: "muted" })}>
            {` · ${optionalText}`}
          </span>
        ) : null}
      </label>
      {children}
      <FieldMessage id={id} error={error} help={help} />
    </div>
  );
}
