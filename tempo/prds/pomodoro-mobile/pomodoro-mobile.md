# Pomodoro — Mobile App PRD

## Summary

A mobile-only pomodoro web app. Single-screen experience that alternates between
focus and break sessions, tracks daily and lifetime stats locally, and exposes
an expanded stats overlay. No accounts, no server, no notifications. State lives
in `localStorage` on the user's device.

The app is designed against an iPhone-sized canvas (393×852). The desktop
two-pane layout has been retired in favor of this mobile design.

## Modes & defaults

- **Focus** — 25 minutes. Light-blue base with a warm orange/red radial bloom
  at the bottom. "Focusing → Short Break" header.
- **Break** — 5 minutes. Deep-blue base with the same warm radial bloom. "Short
  Break → Focus" header.
- Sessions auto-alternate: a completed focus session moves the app into break
  default; a completed break session moves it back into focus default.

## Timer state machine

Each mode independently flows through three states:

```
default ──play──▶ running ──pause──▶ paused ──play──▶ running
   ▲                  │                  │
   │                  ▼                  ▼
   └──────── completed (timer hits 0) ◀──┘
   └──────── stop (from paused) ─────────┘
```

- **default** — full duration shown for the current mode. Play visible. In
  break mode, a green "skip" button sits to the right of play.
- **running** — timer ticks down. Only the pause button is visible.
- **paused** — timer frozen. Play and a red stop button are visible. Timer text
  shifts from its normal color to a muted orange.
- **completed** — only reachable by the timer reaching 0. Logs a session and
  transitions to the next mode's `default`.

### Transition rules

| From      | Action            | To                            | Side effect                                                        |
| --------- | ----------------- | ----------------------------- | ------------------------------------------------------------------ |
| default   | Play              | running                       | start countdown                                                    |
| running   | Pause             | paused                        | freeze remaining; dim timer text                                   |
| paused    | Play              | running                       | resume countdown                                                   |
| paused    | Stop              | default (same mode)           | reset remaining to mode duration                                   |
| default   | Skip (break only) | default (focus)               | discard remaining break; jump to focus default                     |
| running   | Timer hits 0      | default (other mode)          | log session; if focus, increment Today's & Total Pomos             |

## Stats

Four stat boxes are visible on the bottom panel at all times.

- **Today's Pomos** — count of focus sessions completed today (timer reached 0).
  Resets at local midnight.
- **Total Pomos** — lifetime completed focus sessions.
- **Today's Focus Duration** — sum of intervals during which the focus timer
  was actively running today. Pauses do not count. Resets at local midnight.
- **Total Focus Duration** — lifetime equivalent.

A session counts toward "Pomos" only when the timer reaches 0. Stopping or
skipping does not increment Pomos. Focus duration is the actual elapsed running
time, not the configured duration — if the user pauses for 3 minutes, those
3 minutes are not counted.

## Persistence

All state is stored in `localStorage`:

- A daily counter object keyed by local-date string (`YYYY-MM-DD`), holding
  pomos and focus seconds for that day.
- Lifetime totals (pomos, focus seconds).

On load, the app reads the last persisted state. The current mode and remaining
time are not persisted across reloads — the timer always boots into focus
default. (Persisting an in-flight session is out of scope.)

## Expanded stats view

Opening the chart icon (bottom-right of every timer screen) reveals a
full-screen overlay layered over the timer. The overlay shows:

1. The current mode header and timer (read-only, smaller layout) with a clock
   icon at the top-right that closes the overlay.
2. An activity timeline (placeholder — existing component reused as a
   placeholder visual; real implementation deferred).
3. A "Year Grids" heatmap (placeholder block).
4. The same four stat boxes as the bottom panel.
5. A weekly bar chart (placeholder block).
6. A "Daily Average" stat.

The overlay tints with the current mode's gradient at the top so the user
remains oriented to whether focus or break is currently active.

## Out of scope

- Long-break interval (e.g. every 4th break is longer).
- Notifications, sound, vibration.
- Settings UI for adjusting durations.
- Accounts, login, sync.
- Real implementations of the activity timeline, year heatmap, and weekly bar
  chart inside the expanded stats view — these are placeholders for now.
- Persisting an in-flight session across reloads.

## Open questions (resolved)

- **Does focus duration count paused minutes?** No. Only time during which the
  timer was actively running.
- **What counts as a completed session?** Only when the timer reaches 0. Stop
  resets the timer without logging a session. Skip (break only) discards the
  break without logging anything.
