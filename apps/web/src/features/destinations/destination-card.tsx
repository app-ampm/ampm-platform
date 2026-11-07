import { cardStyles, cn, textStyles } from "@ampm/ui/styles";

import { PhotoPlaceholder } from "@/components/site";

import { DESTINATIONS_COPY, type Destination } from "./destinations-content";

/**
 * One destination in the grid (W4): a glass card (radius 28, 10 inside) holding the photo placeholder
 * and, under it, the name in Gilda with the region on its right and the one-line note.
 */
export function DestinationCard({ destination }: { readonly destination: Destination }) {
  return (
    <article
      className={cn(
        cardStyles({ padding: "none" }),
        "h-full gap-1 rounded-2xl p-2.5 md:rounded-2xl",
      )}
    >
      <PhotoPlaceholder
        label={DESTINATIONS_COPY.photo(destination.name)}
        className="h-48 rounded md:h-56 md:rounded"
      />
      <div className="flex flex-col gap-1.5 px-3.5 pb-3.5 pt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className={cn(textStyles({ variant: "heading" }), "md:text-3xl")}>
            {destination.name}
          </h2>
          <p className={textStyles({ variant: "eyebrow", tone: "muted" })}>{destination.region}</p>
        </div>
        <p className={textStyles({ variant: "bodySmall", tone: "body" })}>{destination.note}</p>
      </div>
    </article>
  );
}
