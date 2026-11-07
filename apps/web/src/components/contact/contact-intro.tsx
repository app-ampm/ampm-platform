import { cn, textStyles } from "@ampm/ui/styles";

import { Eyebrow, SectionHeading, metaStyles } from "@/components/site";

import { ContactChannelList } from "./contact-channel-list";
import type { ReachableChannel } from "./contact-channels";
import { CONTACT_HEADING_ID } from "./contact-ids";

/**
 * The contact page's left column (W6): the eyebrow, the heading with the gold "the wedding.", the
 * invitation to share what they know, AMPM's channels and the note that there is no sign-up form.
 * Rendered on the server and handed to the form, which lays the page out.
 */
export function ContactIntro({ channels }: { readonly channels: readonly ReachableChannel[] }) {
  return (
    <div className="flex flex-col gap-5 md:gap-6.5">
      <Eyebrow size="md">Contact</Eyebrow>
      <SectionHeading
        as="h1"
        id={CONTACT_HEADING_ID}
        emphasis="the wedding."
        className="text-5xl tracking-tight md:text-6xl xl:text-7xl"
      >
        Tell us about
      </SectionHeading>
      <p
        className={cn(textStyles({ variant: "body", tone: "body" }), "max-w-md text-lg md:text-xl")}
      >
        Share what you know. Dates and destination can be rough; we'll call you to fill in the rest.
      </p>
      <ContactChannelList channels={channels} />
      <p className={metaStyles}>
        <span className="block">AMPM creates every account after we've spoken.</span>
        <span className="block">There is no sign-up form.</span>
      </p>
    </div>
  );
}
