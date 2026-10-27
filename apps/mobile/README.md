# apps/mobile

The AMPM client and team apps: Expo SDK 58 with Expo Router, NativeWind on the tokens preset, phones and tablets, and the web export that is the browser version of the client portals. Setup and the common scripts are in the root [README](../../README.md); the rules are `.claude/rules/ui.md`, `styling.md` and `offline.md`.

- `src/app/` the routes (Expo Router); `index` is the component gallery until sprint 2, `account` shows `/me`
- `src/features/<feature>/` screens, components and hooks by feature
- `src/navigation/` the navigation container, with a web variant that leaves colours to CSS
- `src/lib/` the public environment (`EXPO_PUBLIC_*`) and the session

```bash
pnpm --filter mobile dev       # Metro on 8082; press i for the iPhone simulator; http://localhost:8082 for the web build
pnpm --filter mobile typecheck
```

Native dependencies are added with `pnpm --filter mobile exec expo install <package>`, never with a plain `pnpm add`.
