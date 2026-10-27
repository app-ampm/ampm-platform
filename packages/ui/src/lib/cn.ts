import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Composes class names: clsx joins (strings, arrays, conditionals), tailwind-merge resolves
 * conflicts so the last class wins (`cn("p-4", condition && "p-2")`). Every component's root
 * does `className={cn(base, className)}` so callers can override.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export type { ClassValue };
