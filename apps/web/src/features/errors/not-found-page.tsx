import { ButtonLink, ENQUIRY_HREF } from "@/components/site";

import { NOT_FOUND_CONTENT as COPY } from "./errors-content";
import { StatusPage } from "./status-page";

/**
 * Any address the site has no page for (and any page that calls `notFound()`), inside the site's
 * frame, so the top bar, the footer and the chat pill still lead on. Next answers it with a 404 and
 * a noindex. The gold action starts again from the home page; the second asks AMPM directly.
 *
 *   export default function NotFound() {
 *     return <NotFoundPage />;
 *   }
 */
export function NotFoundPage() {
  return (
    <StatusPage
      eyebrow={COPY.eyebrow}
      title={COPY.title}
      emphasis={COPY.emphasis}
      body={COPY.body}
      actions={
        <>
          <ButtonLink href="/" size="lg">
            {COPY.home}
          </ButtonLink>
          <ButtonLink href={ENQUIRY_HREF} variant="secondary" size="lg">
            {COPY.contact}
          </ButtonLink>
        </>
      }
    />
  );
}
