# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npx vercel --prod --yes  # Deploy to Vercel production
npx cap sync ios     # Sync Capacitor plugins/config to iOS project
npx drizzle-kit push # Push schema changes to Neon DB (needs DATABASE_URL from .env.local)
npx drizzle-kit generate  # Generate migration SQL files
```

## Architecture

### Dual-platform app
The app is a **Next.js web app** deployed on Vercel, wrapped in a **Capacitor iOS shell** that loads the Vercel production URL (`https://pomodoro-app-mu-hazel.vercel.app`) in WKWebView. The iOS app adds native capabilities (Dynamic Island, haptics, notifications, wake lock) via Capacitor plugins.

### Data flow
- **Client-side**: Timer state lives in `InteractivePomodoro.tsx` (mode, remaining seconds, session refs). Session data persists to `localStorage` under `pomodoro-mobile.v1` / `pomodoro-settings.v1` / `pomodoro-goals.v1`.
- **Server-side**: When signed in, `useSync.ts` pushes sessions to Neon Postgres via API routes. On first sign-in, all local sessions are bulk-synced. The DB is the source of truth for cross-device sync.
- **Break sessions** are stored with `sessionType: "break" | "longBreak"`. Filter them out when computing focus stats (`statsFromPersisted` already does this).

### Component hierarchy
```
InteractivePomodoro (state owner: mode, remaining, persisted, settings)
  └── PomodoroScreen (layout, drag-to-expand panel, background gradients)
        ├── AnimatedTimer (digit-by-digit animated countdown)
        ├── TimerControls (play/pause/stop/skip buttons)
        └── StatsPanel (timeline, weekly chart, year heatmap, focus log, settings)
```

`InteractivePomodoro` owns all timer logic, session recording, and Live Activity plugin calls. `PomodoroScreen` is a pure layout component. State flows down via props; actions flow up via callbacks.

### Key modules
- `pomodoro-types.ts` — Shared types (`PomodoroMode`, `SessionEntry`, `PomodoroSettings`), duration helpers, adaptive target computation
- `useSync.ts` — Auth-aware sync hook: `pushSession`, `bulkPushSessions`, `sync()`, `deleteSession`, `editSession`
- `haptics.ts` — `tapHaptic()` for button presses (light impact)
- `useSwipe.ts` — Horizontal swipe detection hook for week/day navigation

### Database (Neon Postgres + Drizzle ORM)
Schema in `lib/db/schema.ts`. Three tables: `users`, `sessions`, `user_goals`. The `sessions` table has a `session_type` column (`"focus"`, `"break"`, `"longBreak"`).

DB credentials come from `DATABASE_URL` in `.env.local` (Vercel-managed via Neon marketplace integration).

### Auth (Auth.js v5)
Credentials provider with JWT strategy. Sign-up at `/api/auth/sign-up`, session endpoints at `/api/auth/[...nextauth]`. Middleware protects `/api/sessions/*` and `/api/goals/*`.

### iOS Native Layer
- **`ios/App/App/Plugins/LiveActivityPlugin.swift`** — Capacitor plugin for Dynamic Island Live Activities. Iterates all `PomodoroActivityAttributes` activities (no ID tracking). Methods: `start`, `update`, `stop`.
- **`ios/App/PomodoroWidgetExtension/`** — Widget Extension showing timer in Dynamic Island and Lock Screen.
- **`ios/App/App/AppDelegate.swift`** — Registers `LiveActivityPlugin` once via `pluginRegistered` flag in `applicationDidBecomeActive`.
- **`ios/App/PomodoroActivityAttributes.swift`** — Shared between App and Widget Extension targets. ContentState: `endTime`, `mode`, `isRunning`, `remainingSeconds`.
- **JS bridge**: `app/plugins/LiveActivityPlugin.ts`

### Deploy process

| Change type | Vercel deploy | Xcode rebuild |
|---|:---:|:---:|
| React/CSS/API changes | ✅ | ❌ |
| New Capacitor plugin | ✅ | ✅ |
| Swift plugin code | ❌ | ✅ |
| `capacitor.config.ts` | ❌ | ✅ |
| Widget Extension | ❌ | ✅ |

For local iOS dev: change `capacitor.config.ts` → `server.url` to `http://<your-ip>:3000`, run `npx cap sync ios`, rebuild in Xcode. Switch back to the Vercel URL for production.

### Timer completion side effects
Timer completion fires via `queueMicrotask` (outside React's state updater). It reads from refs (`modeRef`, `settingsRef`, `pomosRef`, `syncRef`) to avoid stale closures. This is intentional — don't move the side effects back into the `setRemaining` updater.

### Design conventions
- Colors: `#545b7f` (text), `#8f92a9` (muted), `#e6e1e0` (panel bg), `#d8d0ce` (section bg), `#c65c5c` (focus accent), `#a98461` (amber/paused)
- Containers: `bg-[#d8d0ce] rounded-[12px] p-[14px]`
- Panel border radius: 24px top corners
- Press feedback: `.pressable` / `.pressable-sm` CSS classes
- `NavHeader` component for `‹ label ›` navigation (used by weekly chart + focus log)
