import Link from "next/link";
import type { ReactNode } from "react";

import { cardStyles, cn, textStyles } from "@ampm/ui/styles";

import { reachableChannels } from "@/components/contact/contact-channels";

import { Eyebrow } from "./eyebrow";
import { SITE_COPY } from "./site-copy";
import {
  CLIENT_SIGN_IN_URL,
  ENQUIRY_HREF,
  INSTAGRAM_URL,
  PRIVACY_HREF,
  SITE_NAV_LINKS,
  TERMS_HREF,
  type SiteNavLink,
} from "./site-links";
import { navLinkStyles } from "./site.styles";
import { Wordmark } from "./wordmark";

/** The home page's full footer (W1, W8) or every other page's compact one (W2–W6). */
export type SiteFooterVariant = "home" | "page";

const QUIET_LINK = navLinkStyles({ tone: "muted", textVariant: "bodySmall" });
const QUIET_TEXT = textStyles({ variant: "bodySmall", tone: "muted" });

const PRIVACY: SiteNavLink = { href: PRIVACY_HREF, label: SITE_COPY.privacy };
const TERMS: SiteNavLink = { href: TERMS_HREF, label: SITE_COPY.terms };
const SIGN_IN: SiteNavLink = { href: CLIENT_SIGN_IN_URL, label: SITE_COPY.clientSignIn };
const INSTAGRAM: SiteNavLink[] = INSTAGRAM_URL
  ? [{ href: INSTAGRAM_URL, label: SITE_COPY.instagram }]
  : [];

/** W1, W8: privacy notice, terms and client sign-in. */
const LEGAL_LINKS: readonly SiteNavLink[] = [PRIVACY, TERMS, SIGN_IN];
/** W2–W6 add Instagram, once its address is known, before client sign-in. */
const PAGE_LEGAL_LINKS: readonly SiteNavLink[] = [PRIVACY, TERMS, ...INSTAGRAM, SIGN_IN];
/** W1's Explore column: the pages, Contact apart (it has its own column). */
const EXPLORE_LINKS = SITE_NAV_LINKS.filter((link) => link.href !== ENQUIRY_HREF);

/**
 * W1's Contact column: AMPM's channels that have an address (Instagram among them), or the contact
 * page while none has one, so the column always leads somewhere.
 */
function contactLinks(): readonly SiteNavLink[] {
  const channels = reachableChannels().map(({ href, label }) => ({ href, label }));
  return channels.length > 0 ? channels : [{ href: ENQUIRY_HREF, label: SITE_COPY.sendEnquiry }];
}

/** A site page through next/link; a channel, the portal or another site as a plain anchor. */
function FooterLink({
  link,
  className,
}: {
  readonly link: SiteNavLink;
  readonly className: string;
}) {
  if (link.href.startsWith("/"))
    return (
      <Link href={link.href} className={className}>
        {link.label}
      </Link>
    );
  return (
    <a href={link.href} className={className}>
      {link.label}
    </a>
  );
}

interface LinkRowProps {
  readonly label: string;
  readonly links: readonly SiteNavLink[];
  /** The cards' legal links sit 28 apart (W1–W6); the phone's rows 22 (W8). */
  readonly isWide?: boolean | undefined;
  readonly className?: string | undefined;
}

/** A named row of quiet links that wraps on a narrow window (W1–W8). */
function LinkRow({ label, links, isWide = false, className }: LinkRowProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className={cn("flex flex-wrap", isWide ? "gap-x-7" : "gap-x-5.5")}>
        {links.map((link) => (
          <li key={link.href}>
            <FooterLink link={link} className={QUIET_LINK} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Phone (W8): no card, the wordmark over the five pages and the legal links. */
function PhoneFooter() {
  return (
    <div className="flex flex-col gap-4.5 px-1.5 pt-2 md:hidden">
      <Wordmark className="self-start" />
      <LinkRow label={SITE_COPY.footerNav} links={SITE_NAV_LINKS} />
      <LinkRow label={SITE_COPY.legalNav} links={LEGAL_LINKS} />
    </div>
  );
}

/**
 * From a tablet on every page but home (W2–W6): one glass card with the wordmark, the legal links and
 * the copyright line in a row from 1024. Below 1024 the bar hides the pages behind MENU, so the card
 * lists them too.
 */
function PageCard() {
  return (
    <div
      className={cn(
        cardStyles({ padding: "lg" }),
        "hidden gap-4 md:flex md:px-12 md:py-9 lg:flex-row lg:items-center lg:justify-between lg:gap-8",
      )}
    >
      <Wordmark className="self-start lg:self-center" />
      <LinkRow label={SITE_COPY.footerNav} links={SITE_NAV_LINKS} className="lg:hidden" />
      <LinkRow label={SITE_COPY.legalNav} links={PAGE_LEGAL_LINKS} isWide />
      <p className={QUIET_TEXT}>{SITE_COPY.copyright}</p>
    </div>
  );
}

interface FooterColumnProps {
  readonly id: string;
  readonly title: string;
  readonly links: readonly SiteNavLink[];
}

/** One of W1's link columns: a tracked label over pearl 80% links. */
function FooterColumn({ id, title, links }: FooterColumnProps) {
  return (
    <nav aria-labelledby={id} className="flex flex-col gap-2">
      <Eyebrow size="md">
        <span id={id}>{title}</span>
      </Eyebrow>
      <ul className="flex flex-col">
        {links.map((link) => (
          <li key={link.href}>
            <FooterLink link={link} className={navLinkStyles()} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * From a tablet on the home page (W1): one glass card with AMPM and its line beside the Explore and
 * Contact columns (the mock's 2fr / 1fr / 1fr), then the copyright and the legal links under a
 * hairline.
 */
function HomeCard() {
  return (
    <div className={cn(cardStyles({ padding: "lg" }), "hidden gap-10 md:flex md:p-12")}>
      <div className="grid grid-cols-4 gap-10">
        <div className="col-span-2 flex flex-col gap-3.5">
          <Wordmark className="self-start lg:text-3xl" />
          <p className={cn(textStyles({ variant: "body", tone: "body" }), "max-w-xs")}>
            {SITE_COPY.tagline}
          </p>
        </div>
        <FooterColumn id="footer-explore" title={SITE_COPY.explore} links={EXPLORE_LINKS} />
        <FooterColumn id="footer-contact" title={SITE_COPY.contact} links={contactLinks()} />
      </div>
      <FooterBase>
        <p className={QUIET_TEXT}>{SITE_COPY.copyright}</p>
        <LinkRow label={SITE_COPY.legalNav} links={LEGAL_LINKS} isWide />
      </FooterBase>
    </div>
  );
}

/** W1's last row under a pearl 16% hairline: the copyright on the left, the links on the right. */
function FooterBase({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-8 border-t border-primary/16 pt-6">
      {children}
    </div>
  );
}

/**
 * The site's footer: on a phone (W8) a plain block, with no card, of the wordmark, the pages and the
 * legal links; from a tablet a glass card 40 in from the sides, W1's full footer on the home page and
 * the compact W2–W6 one elsewhere. The space under it is the chat pill's, so the pill never covers it.
 * The layout draws it after <main> (RouteFooter picks the variant from the path), so it stays the
 * page's contentinfo landmark.
 *
 *   <SiteFooter variant="home" />
 */
export function SiteFooter({ variant = "page" }: { readonly variant?: SiteFooterVariant }) {
  return (
    <footer className="relative mx-4 mb-24 md:mx-10 md:mb-28">
      <PhoneFooter />
      {variant === "home" ? <HomeCard /> : <PageCard />}
    </footer>
  );
}
