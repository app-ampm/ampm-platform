# apps/web

The AMPM public website: Next.js 16 with the App Router, Tailwind on the tokens preset, in the Peacock Night design system (`docs/design/peacock-night.md`, mocks W1–W8 in `reference_docs/design/peacock-night/designs/Peacock Night 1 - Website.dc.html`). It is the marketing and enquiry site only; the client portals in the browser are the Expo web export in `apps/mobile`. Hosting is AMPM's dedicated VPS behind Caddy (`docs/engineering/vps-setup.md`, decision R13). `next build` writes Next's standalone server, which `infra/docker/web.Dockerfile` packages as the site's image; until production has its domain block, the test box serves that image at site.ampmverse.com (`docs/engineering/test-deploy.md`). Setup and the common scripts are in the root [README](../../README.md); the rules are `.claude/rules/code.md` and `styling.md`.

- `src/app/` the routes (App Router). The root `layout` is the document alone: it loads the fonts and `globals.css`. The marketing pages live in the `(site)` route group, whose `layout` draws the chrome they share (`SiteFrame`): the glass top bar, the footer (W1's full one on the home page, the compact W2–W6 one elsewhere, plain on a phone as W8 draws it) and the "Chat with AMPM" pill; the root `not-found` draws the same frame. `(site)/page` is the home page (PUB-01), then `how-it-works` (PUB-02 and the plans, PUB-07), `services` (PUB-03), `destinations` (PUB-04), `about` (PUB-05) and `contact`, the enquiry and demo request (PUB-06) with its confirmation (PUB-09); `privacy` and `terms` hold their place until AMPM publishes those documents. Every page repeats `export const dynamic = "force-dynamic"` (D-046).
- `src/components/site/` the site's chrome and DOM building blocks (`ButtonLink`, `GlassCard`, `SectionHeading`, `SectionIntro`, `PhotoPlaceholder`, `GlowOrbs`, `Chip`, `SiteContainer`…), exported from its `index.ts`. They style plain DOM with the kit's class recipes from `@ampm/ui/styles`; the site never imports `@ampm/ui` itself, which is React Native.
- `src/features/<feature>/` a page's own sections and content: `home`, `how-it-works`, `services`, `destinations`, `about`, and `hotel-form`, the hotel information form at `/hotel-form` (D-189 §8) in its own layout without the site's navigation or chat pill; its fields come from `packages/web-forms` (D-175) and its end-to-end tests are in `e2e/`.
- `src/components/` the enquiry form (`contact-form`, `enquiry-fields`, `enquiry-payload`) and its parts in `components/contact`.

```bash
pnpm --filter web dev          # http://localhost:3417 (3000 belongs to another project on the development Mac)
pnpm --filter web build        # downloads the fonts through next/font, so it needs the network
pnpm --filter web typecheck
pnpm --filter web test:e2e     # the hotel form's Playwright and axe tests, against a local API (docs/CONTRIBUTING.md)
```

## Configuration

Read once, validated, in `src/env.ts`; Next inlines `NEXT_PUBLIC_*` at build time, so set them for the build.

| Variable                         | Default                    | What it is                                                                                                                                                                                                                                                                         |
| -------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`            | `http://localhost:3900`    | The API the enquiry form posts to; its origin is allowed in the CSP's `connect-src`.                                                                                                                                                                                               |
| `NEXT_PUBLIC_PORTAL_URL`         | `http://localhost:8082`    | The client portal (the Expo web export). "Client sign-in" opens its `/sign-in`; locally the Expo dev server on 8082.                                                                                                                                                               |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` | The Cloudflare Turnstile widget the enquiry form draws as its bot check; the form sends its token as `botToken`. The default is Cloudflare's always-pass test key, which a local or test API (stub bot check) accepts and production refuses; production builds pass the real key. |

Theme values come only from `packages/tokens` through the Tailwind preset; the app's Tailwind config holds the preset and the content globs and nothing else. Peacock Night is dark only, so the site has no scheme switch.
