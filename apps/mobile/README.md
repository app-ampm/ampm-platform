# apps/mobile

The AMPM client and team apps: Expo SDK 58 with Expo Router, NativeWind on the tokens preset, phones and tablets, and the web export that is the browser version of the client portals. Setup and the common scripts are in the root [README](../../README.md); the rules are `.claude/rules/ui.md`, `styling.md` and `offline.md`.

- `src/app/` the routes (Expo Router). `index` sends a signed-in person to their place (staff to the first workspace area their roles grant, clients to `/portal`), `sign-in` is the development sign-in and `gallery` the component gallery. A top-level route hands its screen the phone tab bar (`<LeadsListScreen tabBar={<AppTabBar />} />`); detail and form routes take none.
- `src/features/<feature>/` screens, components and hooks by feature, built from the Peacock Night kit (`docs/design/peacock-night.md`) on `Screen` and `ScreenHeader`, never a hand-rolled scroll view with insets
- `src/navigation/` the stack and the navigation around it: the phone tab bar (`AppTabBar`), the staff rail and the client top navigation that the layout draws from 768 (`AppChrome`), the areas each audience sees, and the one sign-out (`useSignOut`, drawn by `SignOutButton` on the account screen and under the account and portal error states, so it stays in reach when `/me` fails and the tab bar keeps only More); the stack has a web variant that leaves colours to CSS
- `src/lib/` the public environment (`EXPO_PUBLIC_*`) and the session
- `src/test/` the test render under the app's providers, and `dismissToasts` for tests that raise a toast

```bash
pnpm --filter mobile dev       # Metro on 8082; press i for the iPhone simulator; http://localhost:8082 for the web build
pnpm --filter mobile typecheck
```

Native dependencies are added with `pnpm --filter mobile exec expo install <package>`, never with a plain `pnpm add`.
