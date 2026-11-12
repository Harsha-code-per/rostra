# Rostra web

Next.js 16 App Router. See the [root README](../README.md).

```bash
pnpm install
cp .env.example .env.local
pnpm dev
pnpm lint && pnpm typecheck && pnpm build
pnpm test:e2e        # Playwright + axe; boots the API (SQLite) and the built site itself
```

## Where things live

- `lib/api.ts`: the only module that calls the API. One `request()` handles auth headers, timeouts, a retry for cold starts and 401 (signs the user out).
- `lib/auth-context.tsx`: session in `localStorage` (`rostra_session`).
- `app/dashboard/layout.tsx`: route guard by role. `app/page.tsx` is the landing page; the 3D scene (`components/landing/StoryScene.tsx`) is lazy-loaded and skipped for reduced-motion, no-WebGL and data-saver users.
- `components/shared/Dialog.tsx`: every modal uses the native `<dialog>` (focus trap, Escape, focus return).

## Conventions

- Text on the app is at least 11px and meets WCAG AA contrast; `pnpm test:e2e` fails on any axe violation.
- Brand: `public/logo.svg` is the source for the favicon and app icons.
