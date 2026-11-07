import { variants, type VariantProps } from "../../lib/variants";
import { textStyles } from "../text/text.styles";

/**
 * Peacock Night's field frame: a pill of midnight 50% with a pearl 20% stroke and 18 on each side
 * (the text inside carries the 14 above and below, so its whole height takes a tap). Focus is a gold
 * stroke plus the halo: tracked in React on native (`state: "focused"`) and by `focus-within` on the
 * web, so the website's plain inputs get it from CSS alone. Errors are gold too (there is no red);
 * disabled is a dashed pearl 26% stroke on no fill. Multiline fields trade the pill for radius 22.
 *
 *   <div className={fieldStyles({ state: invalid ? "error" : "default" })}>
 *     <span className={fieldAffixStyles}>
 *       <span className={fieldPrefixTextStyles}>+91</span>
 *       <span className={fieldDividerStyles} />
 *     </span>
 *     <input className={fieldTextStyles()} />
 *   </div>
 */
export const fieldStyles = variants(
  [
    "flex flex-row items-center gap-3 border bg-surface/50 px-4.5",
    "web:focus-within:border-brand web:focus-within:shadow-halo",
  ],
  {
    variants: {
      state: {
        default: "border-primary/20",
        focused: "border-brand web:shadow-halo",
        error: "border-brand",
        // A read-only field can still take focus on the web; it keeps its dashed stroke.
        disabled:
          "border-dashed border-primary/26 bg-transparent web:focus-within:border-primary/26 web:focus-within:shadow-none",
      },
      size: {
        md: "min-h-touch",
        lg: "min-h-12",
      },
      multiline: {
        false: "rounded-full",
        true: "items-start rounded-lg",
      },
    },
    defaultVariants: { state: "default", size: "md", multiline: false },
  },
);

/** The text inside the frame: Manrope 15 in pearl, the placeholder in pearl 58%. */
export const fieldTextStyles = variants(
  "flex-1 bg-transparent py-3.5 font-sans text-base text-primary web:outline-none web:placeholder:text-muted",
  {
    variants: {
      disabled: { true: "text-primary/45", false: "" },
      multiline: { true: "min-h-24 align-top", false: "" },
    },
    defaultVariants: { disabled: false, multiline: false },
  },
);

/** Holds a prefix and its divider; stretches to the frame so the divider spans one line of text. */
export const fieldAffixStyles = "flex flex-row items-center gap-3 self-stretch py-3.5";

/** "+91" before a mobile number: Manrope 600 in pearl 60%. */
export const fieldPrefixTextStyles =
  "font-sans-semibold text-base text-primary/60 web:font-semibold";

/** The 1px pearl 20% rule between a prefix and the value. */
export const fieldDividerStyles = "w-px self-stretch bg-primary/20";

/** The label above a field: Manrope 600 13 in pearl 80%. */
export const fieldLabelStyles = textStyles({ variant: "label", tone: "body" });

/** The help line below a field: Manrope 13 in pearl 58%. */
export const fieldHelpStyles = textStyles({ variant: "bodySmall", tone: "muted" });

/** The error line below a field: Manrope 13 in gold, naming the field ("Enter a 10-digit number"). */
export const fieldErrorStyles = textStyles({ variant: "bodySmall", tone: "brand" });

export type FieldStyleProps = VariantProps<typeof fieldStyles>;
export type FieldState = NonNullable<FieldStyleProps["state"]>;
export type InputSize = NonNullable<FieldStyleProps["size"]>;
