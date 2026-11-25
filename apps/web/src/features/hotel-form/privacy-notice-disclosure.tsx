import { cn, flatTintStyles, focusRingStyles, linkLabelStyles, textStyles } from "@ampm/ui/styles";

import { HOTEL_FORM_COPY as COPY } from "./hotel-form-copy";
import { PRIVACY_NOTICE } from "./privacy-notice";

export interface PrivacyNoticeDisclosureProps {
  /** AMPM's help contact, the address for questions and complaints; whom to ask while it is unset. */
  readonly helpContact: string | null;
}

/**
 * The privacy notice (plan §9.3) behind a native disclosure, on the welcome page and again beside the
 * details page's tick, so it can be read before it is accepted. The summary is a gold 44px target with
 * the focus halo; the notice opens in a flat tint with a heading for each part.
 *
 *   <PrivacyNoticeDisclosure helpContact={state.helpContact} />
 */
export function PrivacyNoticeDisclosure({ helpContact }: PrivacyNoticeDisclosureProps) {
  return (
    <details className={cn(flatTintStyles, "rounded px-4")}>
      <summary
        className={cn(
          linkLabelStyles({ variant: "standalone", textVariant: "bodySmall" }),
          focusRingStyles,
          "flex min-h-touch cursor-pointer items-center rounded-sm",
        )}
      >
        {COPY.details.readNotice}
      </summary>
      <div className="flex flex-col gap-4 pb-4">
        <p className={textStyles({ variant: "caption", tone: "muted" })}>{PRIVACY_NOTICE.dated}</p>
        {PRIVACY_NOTICE.parts.map((part) => (
          <section key={part.heading} className="flex flex-col gap-1.5">
            <h2 className={textStyles({ variant: "label", tone: "primary" })}>{part.heading}</h2>
            {part.paragraphs.map((paragraph) => (
              <p key={paragraph} className={textStyles({ variant: "bodySmall", tone: "body" })}>
                {paragraph}
              </p>
            ))}
          </section>
        ))}
        <p className={textStyles({ variant: "bodySmall", tone: "body" })}>
          {`${PRIVACY_NOTICE.contactLead} ${helpContact ?? COPY.helpFallback}`}
        </p>
      </div>
    </details>
  );
}
