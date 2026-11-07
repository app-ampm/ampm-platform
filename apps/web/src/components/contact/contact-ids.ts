// The form's modules run in the browser: they import the one site module they need, not the chrome's
// barrel (`@/components/site`), so the header and footer stay out of the form's bundle.
import { CHAT_HREF } from "@/components/site/site-links";

/** Element ids the contact page (PUB-06, PUB-09) labels and links to. */
export const CONTACT_HEADING_ID = "contact-heading";
export const RECEIVED_HEADING_ID = "request-received-heading";

/**
 * Where "Chat with AMPM" (`/contact#chat`) lands: the contact channels, or the form while AMPM's
 * channels have no addresses. Read from the link so the two never drift apart.
 */
export const CHAT_ANCHOR_ID = CHAT_HREF.slice(CHAT_HREF.indexOf("#") + 1);
