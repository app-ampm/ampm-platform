import { cn, textStyles } from "@ampm/ui/styles";

import { GlassCard, metaStyles } from "@/components/site";

import { TESTIMONIALS, type Testimonial } from "./home-content";

const QUOTE = cn(textStyles({ variant: "heading" }), "leading-snug lg:text-3xl");

/**
 * One family's words in Gilda over who they are. A testimonial with a phone version shows its shorter
 * quote and source below 768 (W8); one without shows on a tablet and desktop only (W1).
 */
function TestimonialCard({ testimonial }: { readonly testimonial: Testimonial }) {
  const { quote, source, phone } = testimonial;
  return (
    <GlassCard
      as="figure"
      padding="none"
      className={cn("gap-4 p-6.5 md:gap-7 md:p-8 lg:p-11", !phone && "hidden md:flex")}
    >
      <blockquote className={QUOTE}>
        {phone ? <p className="md:hidden">"{phone.quote}"</p> : null}
        <p className={phone ? "hidden md:block" : undefined}>"{quote}"</p>
      </blockquote>
      <figcaption className={metaStyles}>
        {phone ? <span className="md:hidden">{phone.source}</span> : null}
        <span className={phone ? "hidden md:inline" : undefined}>{source}</span>
      </figcaption>
    </GlassCard>
  );
}

/** Two families in their own words (W1); the phone keeps one (W8). */
export function TestimonialsSection() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {TESTIMONIALS.map((testimonial) => (
        <TestimonialCard key={testimonial.source} testimonial={testimonial} />
      ))}
    </div>
  );
}
