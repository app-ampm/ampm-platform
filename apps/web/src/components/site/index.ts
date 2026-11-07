/**
 * The website's chrome and DOM building blocks (Peacock Night, `Peacock Night 1 - Website.dc.html`).
 * Plain Next.js DOM styled with the kit's class recipes from `@ampm/ui/styles`; never `@ampm/ui`
 * itself, which is React Native. Every page reuses these:
 *
 *   import { ButtonLink, GlowOrbs, SectionIntro, SiteContainer } from "@/components/site";
 *
 *   <>
 *     <GlowOrbs />
 *     <SiteContainer className="gap-14 pt-14 md:gap-32 md:pt-28">
 *       <section aria-labelledby="stages-heading">
 *         <SectionIntro eyebrow="How it works" title="Three stages" headingId="stages-heading" />
 *         …
 *       </section>
 *     </SiteContainer>
 *   </>
 *
 * The root layout already draws the top bar, the footer and the chat pill.
 */

// Chrome (the root layout uses these).
export { ChatPill } from "./chat-pill";
export { MobileMenu } from "./mobile-menu";
export { NavLinks } from "./nav-links";
export { RouteFooter } from "./route-footer";
export { SiteFooter } from "./site-footer";
export type { SiteFooterVariant } from "./site-footer";
export { SiteHeader } from "./site-header";
export { MAIN_ID, SkipLink } from "./skip-link";
export { Wordmark } from "./wordmark";

// Building blocks for every page.
export { ButtonLink } from "./button-link";
export type { ButtonLinkProps, ButtonLinkVariant } from "./button-link";
export { Chip } from "./chip";
export type { ChipProps } from "./chip";
export { Eyebrow } from "./eyebrow";
export type { EyebrowProps } from "./eyebrow";
export { GlassCard } from "./glass-card";
export type { GlassCardProps, GlassCardTone } from "./glass-card";
export { GlowOrbs } from "./glow-orbs";
export type { GlowOrbsProps } from "./glow-orbs";
export type { GlowOrbsVariant } from "./glow-orbs.styles";
export { PhotoPlaceholder } from "./photo-placeholder";
export type { PhotoPlaceholderProps } from "./photo-placeholder";
export { SectionHeading } from "./section-heading";
export type { SectionHeadingProps } from "./section-heading";
export { SectionIntro } from "./section-intro";
export type { SectionIntroAction, SectionIntroProps } from "./section-intro";
export { SiteContainer } from "./site-container";
export type { SiteContainerProps } from "./site-container";

// Recipes, links and words.
export {
  metaStyles,
  metaStylesOn,
  navLinkStyles,
  quietToneOn,
  roundButtonStyles,
  siteColumnStyles,
  siteGutterStyles,
  standaloneLinkStyles,
} from "./site.styles";
export {
  CHAT_HREF,
  CLIENT_SIGN_IN_URL,
  DEMO_HREF,
  ENQUIRY_HREF,
  INSTAGRAM_URL,
  PRIVACY_HREF,
  SITE_NAV_LINKS,
  TERMS_HREF,
  isCurrentPath,
  portalUrl,
} from "./site-links";
export type { SiteNavLink } from "./site-links";
export { SITE_COPY } from "./site-copy";
