# apps/web

The AMPM public website: Next.js 16 with the App Router, Tailwind on the tokens preset. It is the marketing and enquiry site only; the client portals in the browser are the Expo web export in `apps/mobile`. Hosting is AMPM's dedicated VPS behind Caddy (`docs/engineering/vps-setup.md`, decision R13). Setup and the common scripts are in the root [README](../../README.md); the rules are `.claude/rules/code.md` and `styling.md`.

- `src/app/` the routes (App Router); `layout` with `globals.css` loads the tokens' CSS variables, `page` is the placeholder home page until the website sprint
- `src/components/` the site's own components; shared ones come from `packages/`

```bash
pnpm --filter web dev          # http://localhost:3417 (3000 belongs to another project on the development Mac)
pnpm --filter web build
pnpm --filter web typecheck
```

Theme values come only from `packages/tokens` through the Tailwind preset; the app's Tailwind config holds the preset and the content globs and nothing else.
