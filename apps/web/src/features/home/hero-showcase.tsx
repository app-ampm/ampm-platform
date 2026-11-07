import { cardStyles, cn, textStyles } from "@ampm/ui/styles";

import { Eyebrow, PhotoPlaceholder } from "@/components/site";

import { FEATURED_WORK } from "./home-content";
import { SELECTED_WORK_ID } from "./home-ids";

/**
 * The hero's right column on a tablet and desktop (W1): the wedding photo placeholder with a glass
 * card for the latest wedding resting on it. The card leads to the selected work further down.
 */
export function HeroShowcase({ className }: { readonly className?: string | undefined }) {
  return (
    <div className={cn("relative min-h-96 flex-col self-stretch", className)}>
      <PhotoPlaceholder label="Wedding photo · Lake Pichola" className="flex-1" />
      <a
        href={`#${SELECTED_WORK_ID}`}
        className={cn(
          cardStyles({ pressable: true, padding: "lg" }),
          // Absolute: the card rests on the photo's lower edge, 20 in from its sides (W1).
          "absolute inset-x-5 bottom-5 flex-row items-end justify-between gap-4 py-5.5",
        )}
      >
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Selected work</Eyebrow>
          <p className={textStyles({ variant: "heading" })}>{FEATURED_WORK.title}</p>
          <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{FEATURED_WORK.meta}</p>
        </div>
        <span
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand text-lg text-brand-ink"
        >
          →
        </span>
      </a>
    </div>
  );
}
