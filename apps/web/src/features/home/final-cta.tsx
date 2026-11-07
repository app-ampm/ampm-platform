import { cn, textStyles } from "@ampm/ui/styles";

import { channelHref } from "@/components/contact/contact-channels";
import {
  ButtonLink,
  DEMO_HREF,
  ENQUIRY_HREF,
  GlowOrbs,
  SectionHeading,
  navLinkStyles,
} from "@/components/site";

import { FINAL_CTA_HEADING_ID } from "./home-ids";

/**
 * Desktop (W1): the demo request, the enquiry and the WhatsApp line in a column on the right. The
 * line opens AMPM's WhatsApp, so it shows only once AMPM has given the number (contact-channels.ts).
 */
function DesktopActions() {
  const whatsApp = channelHref("whatsapp");
  return (
    <div className="relative hidden flex-col gap-3 md:col-span-5 md:flex">
      <ButtonLink href={DEMO_HREF} size="lg" fullWidth>
        Request a demo
      </ButtonLink>
      <ButtonLink href={ENQUIRY_HREF} variant="secondary" size="lg" fullWidth>
        Send an enquiry
      </ButtonLink>
      {whatsApp ? (
        <a
          href={whatsApp}
          className={cn(navLinkStyles({ tone: "muted", textVariant: "bodySmall" }), "self-center")}
        >
          Or message us on WhatsApp
        </a>
      ) : null}
    </div>
  );
}

/**
 * The closing call to action. Desktop (W1): a large base-glass card (radius 28) with its own gold orb,
 * the heading and a line on the left (seven twelfths, the mock's 1.4fr) and the actions on the right.
 * Phone (W8): a gold glass card with the heading and the gold "Send an enquiry".
 */
export function FinalCta() {
  return (
    <section
      aria-labelledby={FINAL_CTA_HEADING_ID}
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-xl border px-6 py-7 backdrop-blur-glass backdrop-saturate-glass",
        "border-brand/50 bg-brand/14 shadow-rim-gold",
        "md:grid md:grid-cols-12 md:items-center md:gap-12 md:rounded-2xl md:border-primary/16 md:bg-surface/50 md:p-12 md:shadow-rim xl:p-20",
      )}
    >
      <GlowOrbs variant="card" className="hidden md:block" />
      <div className="relative flex flex-col gap-4.5 md:col-span-7">
        <SectionHeading id={FINAL_CTA_HEADING_ID} emphasis="your wedding." className="xl:text-6xl">
          Tell us about
        </SectionHeading>
        <p
          className={cn(
            textStyles({ variant: "body", tone: "body" }),
            "hidden max-w-lg text-lg md:block",
          )}
        >
          Rough dates and a destination are enough to start. We'll call you, and if you'd like a
          demo we'll set it up.
        </p>
      </div>
      <ButtonLink href={ENQUIRY_HREF} size="lg" fullWidth className="relative md:hidden">
        Send an enquiry
      </ButtonLink>
      <DesktopActions />
    </section>
  );
}
