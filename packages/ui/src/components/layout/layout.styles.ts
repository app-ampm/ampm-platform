/** Spacing steps the layout components accept; full class names so Tailwind can see them. */
export type Gap = 0 | 1 | 2 | 3 | 4 | 6 | 8;

export const gapClass: Record<Gap, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

export const spacerClass: Record<Exclude<Gap, 0>, { vertical: string; horizontal: string }> = {
  1: { vertical: "h-1", horizontal: "w-1" },
  2: { vertical: "h-2", horizontal: "w-2" },
  3: { vertical: "h-3", horizontal: "w-3" },
  4: { vertical: "h-4", horizontal: "w-4" },
  6: { vertical: "h-6", horizontal: "w-6" },
  8: { vertical: "h-8", horizontal: "w-8" },
};

export type Align = "start" | "center" | "end" | "stretch";
export type Justify = "start" | "center" | "end" | "between";

export const alignClass: Record<Align, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

export const justifyClass: Record<Justify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
};
