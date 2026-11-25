import { fieldErrorStyles, fieldHelpStyles } from "@ampm/ui/styles";

export interface FieldMessageOptions {
  /** Shown in gold under the field instead of the help; marks the control invalid. */
  readonly error?: string | undefined;
  /** A line under the field in pearl 58% while there is no error. */
  readonly help?: string | undefined;
}

/**
 * The ARIA a field's control carries so screen readers announce the problem on the right field (E5):
 * invalid while it has an error, described by the error or else its help, required when it must be
 * filled. Spread it on the control right after its id.
 *
 *   <input id="email" {...fieldAria("email", { error, help })} />
 */
export function fieldAria(
  id: string,
  { error, help, required }: FieldMessageOptions & { readonly required?: boolean | undefined },
) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : help ? `${id}-help` : undefined,
    "aria-required": required ? true : undefined,
  };
}

/**
 * The line under a field, named after its control's id: the error in gold, announced (the input keeps
 * what was typed), or the help in pearl 58%.
 */
export function FieldMessage({ id, error, help }: { readonly id: string } & FieldMessageOptions) {
  if (error)
    return (
      <p id={`${id}-error`} role="alert" className={fieldErrorStyles}>
        {error}
      </p>
    );
  if (!help) return null;
  return (
    <p id={`${id}-help`} className={fieldHelpStyles}>
      {help}
    </p>
  );
}
