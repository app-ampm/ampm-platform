import { cn, textStyles } from "@ampm/ui/styles";

import { GlassCard } from "@/components/site";

import { PRINCIPLES } from "./about-content";

/**
 * The three principles (W5): base, gold and peacock glass cards in a row from 1024, stacked below,
 * each a Gilda title over a line of body text.
 */
export function PrinciplesList() {
  return (
    <ul className="flex flex-col gap-3 md:gap-5 lg:grid lg:grid-cols-3">
      {PRINCIPLES.map((principle) => (
        <GlassCard
          key={principle.title}
          as="li"
          tone={principle.tone}
          padding="none"
          className="gap-3 p-6 md:gap-4 md:p-9"
        >
          <h2 className={cn(textStyles({ variant: "heading" }), "md:text-3xl")}>
            {principle.title}
          </h2>
          <p className={textStyles({ variant: "body", tone: "body" })}>{principle.body}</p>
        </GlassCard>
      ))}
    </ul>
  );
}
