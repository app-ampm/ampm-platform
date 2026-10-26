import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./cn";

/**
 * The variant helper: class-variance-authority with tailwind-merge on the way out, so a variant's
 * classes override the base's instead of fighting them in CSS order. Lives in `<name>.styles.ts`
 * next to the component (.claude/rules/styling.md):
 *
 *   export const buttonStyles = variants("h-touch rounded px-4", {
 *     variants: { tone: { brand: "bg-brand", danger: "bg-danger" }, size: { md: "px-4", lg: "px-6" } },
 *     defaultVariants: { tone: "brand", size: "md" },
 *   });
 *   export type ButtonStyleProps = VariantProps<typeof buttonStyles>;
 *
 * and in the component: `className={cn(buttonStyles({ tone, size }), className)}`.
 */
export function variants<T>(...args: Parameters<typeof cva<T>>): ReturnType<typeof cva<T>> {
  const compute = cva<T>(...args);
  return (props) => cn(compute(props));
}

export type { VariantProps };
