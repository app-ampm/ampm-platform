import type { ReactNode } from "react";

import { cn, textStyles } from "@ampm/ui/styles";

import { Eyebrow, GlowOrbs, SectionHeading, SiteContainer } from "@/components/site";

export interface StatusPageProps {
  /** What happened, in a few words ("Page not found"). */
  readonly eyebrow: string;
  /** The page's heading before its gold ending. */
  readonly title: string;
  /** The heading's gold ending ("isn't here."). */
  readonly emphasis: string;
  /** One line: why it may have happened and the way on. */
  readonly body: string;
  /** The page's buttons, the one gold action first. */
  readonly actions: ReactNode;
}

/**
 * The frame of the site's not-found and error pages: the eyebrow, the page's h1 with its gold ending,
 * one line and the buttons, under the page's glow, in the legal pages' column. No business words and
 * no hooks, so the server-rendered not-found page and the client error pages share it.
 *
 *   <StatusPage eyebrow="Page not found" title="This page" emphasis="isn't here." body="…"
 *     actions={<ButtonLink href="/" size="lg">Back to home</ButtonLink>} />
 */
export function StatusPage({ eyebrow, title, emphasis, body, actions }: StatusPageProps) {
  return (
    <>
      <GlowOrbs />
      <SiteContainer className="gap-5 pb-14 pt-14 md:gap-6 md:pb-24 md:pt-24">
        <Eyebrow size="md">{eyebrow}</Eyebrow>
        <SectionHeading as="h1" emphasis={emphasis} className="text-5xl md:text-6xl">
          {title}
        </SectionHeading>
        <p className={cn(textStyles({ variant: "body", tone: "body" }), "max-w-xl text-lg")}>
          {body}
        </p>
        <div className="flex flex-col gap-3 pt-2 md:flex-row">{actions}</div>
      </SiteContainer>
    </>
  );
}
