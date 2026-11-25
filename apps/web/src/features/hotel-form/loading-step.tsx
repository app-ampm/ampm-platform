import { cn, skeletonStyles, textStyles } from "@ampm/ui/styles";

import { GlassCard } from "@/components/site/glass-card";

/**
 * The card while the link opens or the signed-in page loads: skeleton lines in pearl 6% (peacock-night.md
 * §5, Loading) at the size of a step, and the words for screen readers in a status region.
 *
 *   <LoadingStep label="Opening your link…" />
 */
export function LoadingStep({ label }: { readonly label: string }) {
  return (
    <GlassCard padding="lg" className="w-full max-w-xl gap-4 md:p-9">
      <p role="status" className={textStyles({ variant: "bodySmall", tone: "muted" })}>
        {label}
      </p>
      {["w-1/3", "w-4/5", "w-full", "w-2/3"].map((width) => (
        <div key={width} aria-hidden className={cn(skeletonStyles({ shape: "text" }), width)} />
      ))}
    </GlassCard>
  );
}
