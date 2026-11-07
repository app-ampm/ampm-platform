import Link from "next/link";

import { cn, textStyles } from "@ampm/ui/styles";

import { ENQUIRY_HREF, GlassCard, PhotoPlaceholder, standaloneLinkStyles } from "@/components/site";

import type { Service } from "./services-content";

/**
 * What a service covers: an outlined pill in Manrope 13 on 14 × 8 padding with a pearl 30% stroke (the
 * filter chip's look as the mock draws it), but a plain list item, since nothing here is selectable.
 */
const TAG = cn(
  textStyles({ variant: "bodySmall", tone: "primary" }),
  "flex items-center rounded-full border border-primary/30 px-3.5 py-2",
);

interface ServicePanelProps {
  readonly service: Service;
  /** The photo goes on the right from 1024 (the second and fourth panels of W3). */
  readonly isFlipped: boolean;
}

/** The words: the gold eyebrow, the Gilda title, the description, the pills and the enquiry link. */
function ServiceText({ service, isFlipped }: ServicePanelProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 px-3 pb-4 md:gap-4.5 md:px-4 md:pb-5 lg:p-0",
        isFlipped ? "lg:pl-8" : "lg:pr-8",
      )}
    >
      <p className={cn(textStyles({ variant: "eyebrow", tone: "brand" }), "md:text-xs")}>
        Service {service.number}
      </p>
      <h2 className={cn(textStyles({ variant: "title" }), "text-3xl md:text-4xl lg:text-5xl")}>
        {service.title}
      </h2>
      <p className={cn(textStyles({ variant: "body", tone: "body" }), "md:text-lg")}>
        {service.description}
      </p>
      <ul className="flex flex-wrap gap-2">
        {service.tags.map((tag) => (
          <li key={tag} className={TAG}>
            {tag}
          </li>
        ))}
      </ul>
      <Link href={ENQUIRY_HREF} className={standaloneLinkStyles}>
        {service.enquiry}
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}

/**
 * One service (W3): a photo placeholder and its words in one glass panel (base glass, peacock for
 * complete management). From 1024 the two sit side by side, the photo 384 tall and alternating
 * sides; below that the photo leads and the words follow, as a phone reads a card.
 */
export function ServicePanel({ service, isFlipped }: ServicePanelProps) {
  return (
    <GlassCard
      as="li"
      tone={service.tone}
      padding="none"
      className="gap-5 p-2.5 md:gap-6 md:rounded-2xl md:p-5 lg:grid lg:grid-cols-2 lg:items-center lg:gap-10"
    >
      <PhotoPlaceholder
        label={service.photo}
        tone={service.photoTone}
        className={cn("h-48 rounded md:h-72 md:rounded-xl lg:h-96", isFlipped && "lg:order-last")}
      />
      <ServiceText service={service} isFlipped={isFlipped} />
    </GlassCard>
  );
}
