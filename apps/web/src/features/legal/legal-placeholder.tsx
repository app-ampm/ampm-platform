import { cn, textStyles } from "@ampm/ui/styles";

import { GlowOrbs, SectionHeading, SiteContainer } from "@/components/site";

export interface LegalPlaceholderProps {
  /** The document's name, the page's heading ("Privacy notice"). */
  readonly title: string;
  /** The line saying when AMPM publishes it. */
  readonly body: string;
}

/**
 * Where the footer's and the enquiry form's privacy and terms links land until AMPM publishes those
 * documents: the document's name and one line, under the page's glow. No artboard draws these pages;
 * they keep the placeholders out of the footers, which match W1–W8.
 *
 *   <LegalPlaceholder title="Privacy notice" body="AMPM publishes its privacy notice here…" />
 */
export function LegalPlaceholder({ title, body }: LegalPlaceholderProps) {
  return (
    <>
      <GlowOrbs />
      <SiteContainer className="gap-5 pb-14 pt-14 md:gap-6 md:pb-24 md:pt-24">
        <SectionHeading as="h1" className="text-5xl md:text-6xl">
          {title}
        </SectionHeading>
        <p className={cn(textStyles({ variant: "body", tone: "body" }), "max-w-xl text-lg")}>
          {body}
        </p>
      </SiteContainer>
    </>
  );
}
