"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PomodoroScreen from "./PomodoroScreen";
import { useSync } from "./useSync";
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  DEFAULT_SETTINGS,
  FOCUS_DURATION_SECONDS,
  formatTimer,
  modeDuration,
  type PomodoroMode,
  type PomodoroSettings,
  type PomodoroState,
  type PomodoroStats,
  type SessionEntry,
} from "./pomodoro-types";

const STORAGE_KEY = "pomodoro-mobile.v1";
const GOALS_STORAGE_KEY = "pomodoro-goals.v1";
const SETTINGS_STORAGE_KEY = "pomodoro-settings.v1";
const TIMER_STATE_KEY = "pomodoro-timer-state.v1";

interface TimerSnapshot {
  mode: PomodoroMode;
  state: PomodoroState;
  remaining: number;
  pomosBeforeLongBreak: number;
}

function loadTimerSnapshot(): TimerSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(TIMER_STATE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as TimerSnapshot;
    if (s.state === "default") return null;
    if (typeof s.remaining !== "number" || s.remaining <= 0) return null;
    return s;
  } catch { return null; }
}

function saveTimerSnapshot(s: TimerSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    if (s.state === "default") {
      window.localStorage.removeItem(TIMER_STATE_KEY);
    } else {
      window.localStorage.setItem(TIMER_STATE_KEY, JSON.stringify(s));
    }
  } catch { /* ignore */ }
}

function loadSettings(): PomodoroSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<PomodoroSettings> };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

interface PersistedGoals {
  weeklyGoalMinutes: number;
  lastWeekKey: string;
}

function isoWeekKey(date: Date): string {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function loadGoal(): PersistedGoals {
  const fallback: PersistedGoals = {
    weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL_MINUTES,
    lastWeekKey: "",
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(GOALS_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<PersistedGoals>;
    return {
      weeklyGoalMinutes:
        parsed.weeklyGoalMinutes ?? DEFAULT_WEEKLY_GOAL_MINUTES,
      lastWeekKey: parsed.lastWeekKey ?? "",
    };
  } catch {
    return fallback;
  }
}

function saveGoal(g: PersistedGoals): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(g));
  } catch {
    /* ignore */
  }
}


interface PersistedDayEntry {
  pomos: number;
  focusSeconds: number;
  sessions: SessionEntry[];
}

interface Persisted {
  byDate: Record<string, PersistedDayEntry>;
  totalPomos: number;
  totalFocusSeconds: number;
}

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function todayKey(): string {
  return dateKey(new Date());
}

function weeklyFocusMinutesFromByDate(
  byDate: Record<string, PersistedDayEntry>,
): number[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - now.getDay());
  const result = new Array<number>(7).fill(0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const entry = byDate[dateKey(d)];
    if (entry) result[i] = Math.floor(entry.focusSeconds / 60);
  }
  return result;
}

function loadPersisted(storageKey: string): Persisted {
  if (typeof window === "undefined") {
    return { byDate: {}, totalPomos: 0, totalFocusSeconds: 0 };
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return { byDate: {}, totalPomos: 0, totalFocusSeconds: 0 };
    const parsed = JSON.parse(raw) as Persisted;
    return {
      byDate: parsed.byDate ?? {},
      totalPomos: parsed.totalPomos ?? 0,
      totalFocusSeconds: parsed.totalFocusSeconds ?? 0,
    };
  } catch {
    return { byDate: {}, totalPomos: 0, totalFocusSeconds: 0 };
  }
}

function savePersisted(storageKey: string, p: Persisted): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function statsFromPersisted(p: Persisted): PomodoroStats {
  const day = p.byDate[todayKey()] ?? {
    pomos: 0,
    focusSeconds: 0,
    sessions: [],
  };
  const allSessions = day.sessions ?? [];
  const focusSessions = allSessions.filter((s) => !s.type || s.type === "focus");
  return {
    todayPomos: day.pomos,
    todayFocusMinutes: Math.floor(day.focusSeconds / 60),
    totalPomos: p.totalPomos,
    totalFocusMinutes: Math.floor(p.totalFocusSeconds / 60),
    todaySessions: focusSessions,
    weeklyFocusMinutes: weeklyFocusMinutesFromByDate(p.byDate),
    byDate: p.byDate,
  };
}

export interface InteractivePomodoroProps {
  storageKey?: string;
  speed?: number;
  /** Fill the viewport instead of using fixed 393×852 dimensions. */
  fullscreen?: boolean;
}

export default function InteractivePomodoro(props: InteractivePomodoroProps) {
  const storageKey = props.storageKey ?? STORAGE_KEY;
  const speed = Math.max(1, Math.floor(props.speed ?? 1));

  const savedSnapshot = useRef(loadTimerSnapshot());
  const initialSettings = useRef(loadSettings());
  const [mode, setMode] = useState<PomodoroMode>(() => savedSnapshot.current?.mode ?? "focus");
  const [state, setState] = useState<PomodoroState>(() => savedSnapshot.current ? "paused" : "default");
  const [remaining, setRemaining] = useState<number>(() =>
    savedSnapshot.current?.remaining ?? modeDuration(savedSnapshot.current?.mode ?? "focus", initialSettings.current));
  const [pomosBeforeLongBreak, setPomosBeforeLongBreak] = useState<number>(() => savedSnapshot.current?.pomosBeforeLongBreak ?? 0);
  const [persisted, setPersisted] = useState<Persisted>({
    byDate: {},
    totalPomos: 0,
    totalFocusSeconds: 0,
  });
  const [goals, setGoals] = useState<PersistedGoals>({
    weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL_MINUTES,
    lastWeekKey: "",
  });
  const [showStats, setShowStats] = useState<boolean>(false);
  const [settings, setSettings] = useState<PomodoroSettings>(initialSettings.current);

  const sessionStartRef = useRef<number | null>(
    savedSnapshot.current && savedSnapshot.current.mode === "focus"
      ? Date.now() - Math.max(0, modeDuration("focus", initialSettings.current) - savedSnapshot.current.remaining) * 1000
      : null,
  );
  const breakStartRef = useRef<number | null>(null);
  const completingRef = useRef(false);
  const simNowRef = useRef<number>(Date.now());
  const [simNow, setSimNow] = useState<number>(Date.now());

  const sync = useSync();
  const persistedRef = useRef<Persisted>({
    byDate: {},
    totalPomos: 0,
    totalFocusSeconds: 0,
  });
  const goalsRef = useRef<PersistedGoals>({
    weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL_MINUTES,
    lastWeekKey: "",
  });
  const lastSyncedUserRef = useRef<string | null>(null);

  useEffect(() => {
    const data = loadPersisted(storageKey);
    setPersisted(data);

    const loadedGoals = loadGoal();
    const now = new Date();
    const currentWeekKey = isoWeekKey(now);
    let nextGoals: PersistedGoals = loadedGoals;
    if (!loadedGoals.lastWeekKey) {
      nextGoals = { ...loadedGoals, lastWeekKey: currentWeekKey };
    } else if (loadedGoals.lastWeekKey !== currentWeekKey) {
      nextGoals = {
        weeklyGoalMinutes: loadedGoals.weeklyGoalMinutes,
        lastWeekKey: currentWeekKey,
      };
    }
    if (nextGoals !== loadedGoals) saveGoal(nextGoals);
    setGoals(nextGoals);

    // Settings are loaded synchronously at init (see initialSettings), so we only
    // need to keep the weekly goal in sync with the saved daily goal here.
    {
      const loaded = initialSettings.current;
      const derivedWeekly = loaded.dailyGoalHours * 60 * 7;
      setGoals((prev) => {
        if (prev.weeklyGoalMinutes !== derivedWeekly) {
          const updated = { ...prev, weeklyGoalMinutes: derivedWeekly };
          saveGoal(updated);
          return updated;
        }
        return prev;
      });
    }
  }, [storageKey]);

  useEffect(() => {
    saveTimerSnapshot({ mode, state, remaining, pomosBeforeLongBreak });
  }, [mode, state, remaining, pomosBeforeLongBreak]);

  const handleSettingsChange = useCallback((next: PomodoroSettings) => {
    setSettings(next);
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next));
    } catch { /* ignore */ }
    setGoals((prev) => ({
      ...prev,
      weeklyGoalMinutes: next.dailyGoalHours * 60 * 7,
    }));
    setState((s) => {
      if (s === "default") {
        setRemaining(modeDuration(mode, next));
      }
      return s;
    });
  }, [mode]);

  useEffect(() => {
    persistedRef.current = persisted;
    savePersisted(storageKey, persisted);
  }, [persisted, storageKey]);

  useEffect(() => {
    goalsRef.current = goals;
  }, [goals]);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const pomosRef = useRef(pomosBeforeLongBreak);
  pomosRef.current = pomosBeforeLongBreak;

  const syncRef = useRef(sync);
  syncRef.current = sync;

  useEffect(() => {
    if (!sync.authed || !sync.email) return;
    if (lastSyncedUserRef.current === sync.email) return;
    lastSyncedUserRef.current = sync.email;

    (async () => {
      const s = syncRef.current;
      const localPersisted = persistedRef.current;
      const localGoals = goalsRef.current;

      const localSessions: {
        dateKey: string;
        startTime: number;
        durationSeconds: number;
        isCompleted: boolean;
        sessionType?: string;
      }[] = [];
      for (const [dateKey, day] of Object.entries(localPersisted.byDate)) {
        const sessions = day.sessions ?? [];
        for (let i = 0; i < sessions.length; i++) {
          const se = sessions[i];
          const isFocus = !se.type || se.type === "focus";
          localSessions.push({
            dateKey,
            startTime: se.startTime,
            durationSeconds: se.durationSeconds,
            isCompleted: isFocus && se.durationSeconds >= FOCUS_DURATION_SECONDS,
            sessionType: se.type ?? "focus",
          });
        }
      }

      if (localSessions.length > 0) {
        await s.bulkPushSessions(localSessions);
      }
      if (localGoals.lastWeekKey) {
        s.pushGoals({
          weeklyGoalMinutes: localGoals.weeklyGoalMinutes,
          carryoverMinutes: 0,
          lastWeekKey: localGoals.lastWeekKey,
        });
      }

      const result = await s.sync();
      if (!result) return;
      setPersisted(result.persisted);
      if (result.goals && result.goals.lastWeekKey) {
        setGoals(result.goals);
      }
    })();
  }, [sync.authed, sync.email]);

  useEffect(() => {
    if (!sync.authed) lastSyncedUserRef.current = null;
  }, [sync.authed]);

  const addFocusSeconds = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    setPersisted((prev) => {
      const key = todayKey();
      const day = prev.byDate[key] ?? {
        pomos: 0,
        focusSeconds: 0,
        sessions: [],
      };
      return {
        ...prev,
        byDate: {
          ...prev.byDate,
          [key]: { ...day, focusSeconds: day.focusSeconds + seconds },
        },
        totalFocusSeconds: prev.totalFocusSeconds + seconds,
      };
    });
  }, []);

  const addSession = useCallback((entry: SessionEntry) => {
    setPersisted((prev) => {
      const key = todayKey();
      const day = prev.byDate[key] ?? {
        pomos: 0,
        focusSeconds: 0,
        sessions: [],
      };
      return {
        ...prev,
        byDate: {
          ...prev.byDate,
          [key]: { ...day, sessions: [...(day.sessions ?? []), entry] },
        },
      };
    });
  }, []);

  const completeFocusSession = useCallback(() => {
    const startedAt = sessionStartRef.current;
    sessionStartRef.current = null;
    const key = todayKey();
    setPersisted((prev) => {
      const day = prev.byDate[key] ?? {
        pomos: 0,
        focusSeconds: 0,
        sessions: [],
      };
      const sessions =
        startedAt !== null
          ? [
              ...(day.sessions ?? []),
              {
                startTime: startedAt,
                durationSeconds: settingsRef.current.focusDurationMinutes * 60,
                type: "focus" as const,
              },
            ]
          : (day.sessions ?? []);
      return {
        ...prev,
        byDate: {
          ...prev.byDate,
          [key]: { ...day, pomos: day.pomos + 1, sessions },
        },
        totalPomos: prev.totalPomos + 1,
      };
    });
    if (startedAt !== null) {
      sync.pushSession({
        dateKey: key,
        startTime: startedAt,
        durationSeconds: settingsRef.current.focusDurationMinutes * 60,
        isCompleted: true,
      });
    }
  }, [sync]);

  useEffect(() => {
    if (state !== "running") return;

    let cleanup: (() => void) | null = null;

    (async () => {
      try {
        const { KeepAwake } = await import("@capacitor-community/keep-awake");
        await KeepAwake.keepAwake();
        cleanup = () => { KeepAwake.allowSleep().catch(() => {}); };
        return;
      } catch {}

      if (!("wakeLock" in navigator)) return;
      let lock: WakeLockSentinel | null = null;
      let released = false;
      const acquire = () => {
        navigator.wakeLock.request("screen").then((l) => {
          if (released) { l.release(); return; }
          lock = l;
          l.addEventListener("release", () => { lock = null; });
        }).catch(() => {});
      };
      acquire();
      const onVisibility = () => {
        if (document.visibilityState === "visible") acquire();
      };
      document.addEventListener("visibilitychange", onVisibility);
      cleanup = () => {
        released = true;
        document.removeEventListener("visibilitychange", onVisibility);
        lock?.release();
      };
    })();

    return () => { cleanup?.(); };
  }, [state]);

  const lastTickRef = useRef<number | null>(null);
  useEffect(() => {
    completingRef.current = false;
    if (state !== "running") {
      lastTickRef.current = null;
      document.title = "Pomodoro";
      return;
    }
    lastTickRef.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const last = lastTickRef.current ?? now;
      lastTickRef.current = now;
      const wallElapsed = Math.max(0, Math.round((now - last) / 1000));
      if (wallElapsed === 0) return;
      const elapsed = wallElapsed * speed;

      simNowRef.current += elapsed * 1000;
      setSimNow(simNowRef.current);

      if (mode === "focus") addFocusSeconds(elapsed);

      setRemaining((prevRemaining) => {
        const next = prevRemaining - elapsed;
        if (next <= 0) {
          // Guard against double-fire: the interval can tick again before React
          // re-renders with state="default" and clears the interval.
          if (completingRef.current) return 0;
          completingRef.current = true;
          // Schedule completion side effects outside the updater via microtask
          queueMicrotask(() => {
            const curMode = modeRef.current;
            const curSettings = settingsRef.current;
            const curPomos = pomosRef.current;
            let nextMode: PomodoroMode;
            if (curMode === "focus") {
              completeFocusSession();
              const newCount = curPomos + 1;
              if (newCount >= curSettings.longBreakInterval) {
                nextMode = "longBreak";
                setPomosBeforeLongBreak(0);
              } else {
                nextMode = "break";
                setPomosBeforeLongBreak(newCount);
              }
              breakStartRef.current = Date.now();
            } else {
              const breakType = curMode as "break" | "longBreak";
              const breakDuration = curMode === "longBreak"
                ? curSettings.longBreakDurationMinutes * 60
                : curSettings.breakDurationMinutes * 60;
              const breakStart = breakStartRef.current ?? (Date.now() - breakDuration * 1000);
              addSession({ startTime: breakStart, durationSeconds: breakDuration, type: breakType });
              syncRef.current.pushSession({
                dateKey: todayKey(),
                startTime: breakStart,
                durationSeconds: breakDuration,
                isCompleted: true,
                sessionType: breakType,
              });
              breakStartRef.current = null;
              nextMode = "focus";
            }
            setMode(nextMode);
            setState("default");
            setRemaining(modeDuration(nextMode, curSettings));
            document.title = "Pomodoro";
            const title = curMode === "focus" ? "Focus session complete!" : "Break is over!";
            const body = curMode === "focus"
              ? (nextMode === "longBreak" ? "Time for a long break!" : "Time for a break.")
              : "Ready to focus again.";
            import("@/app/plugins/LiveActivityPlugin").then(({ LiveActivity }) => {
              LiveActivity.stop({ mode: curMode }).catch(() => {});
            }).catch(() => {});
            import("@capacitor/haptics").then(({ Haptics, ImpactStyle }) => {
              // Aggressive burst pattern over ~1.5s for unmistakable vibration
              const fire = () => Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
              fire();
              setTimeout(fire, 80);
              setTimeout(fire, 160);
              setTimeout(fire, 240);
              // pause
              setTimeout(fire, 500);
              setTimeout(fire, 580);
              setTimeout(fire, 660);
              setTimeout(fire, 740);
              // pause
              setTimeout(fire, 1000);
              setTimeout(fire, 1080);
              setTimeout(fire, 1160);
              setTimeout(fire, 1240);
            }).catch(() => {});
            // Also try navigator.vibrate for a long buzz (works on some devices)
            if ("vibrate" in navigator) {
              navigator.vibrate([200, 100, 200, 100, 200, 100, 200]);
            }
            import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
              LocalNotifications.schedule({
                notifications: [{ title, body, id: Date.now(), schedule: { at: new Date() } }],
              });
            }).catch(() => {
              if ("Notification" in window && Notification.permission === "granted") {
                new Notification(title, { body, icon: "/icon-192.png" });
              }
            });
          });
          return 0;
        }
        const modeLabel = mode === "focus" ? "Focusing" : mode === "longBreak" ? "Long Break" : "Break";
        document.title = `${formatTimer(next)} — ${modeLabel}`;
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, mode, speed, addFocusSeconds, completeFocusSession, pomosBeforeLongBreak, settings]);

  const handlePlay = useCallback(() => {
    if (mode === "focus" && state === "default") {
      sessionStartRef.current = Date.now();
    } else if (mode === "focus" && state === "paused" && sessionStartRef.current !== null) {
      const elapsed = Math.max(0, modeDuration("focus", settings) - remaining);
      sessionStartRef.current = Date.now() - elapsed * 1000;
    }
    setState("running");
    import("@/app/plugins/LiveActivityPlugin").then(({ LiveActivity }) => {
      if (state === "paused") {
        LiveActivity.update({ remainingSeconds: remaining, mode, isRunning: true }).catch(() => {});
      } else {
        LiveActivity.start({ remainingSeconds: remaining, mode }).catch(() => {});
      }
    }).catch(() => {});
    import("@capacitor/local-notifications").then(({ LocalNotifications }) => {
      LocalNotifications.requestPermissions();
    }).catch(() => {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
      }
    });
  }, [mode, state, remaining, settings]);

  const handlePause = useCallback(() => {
    setState("paused");
    import("@/app/plugins/LiveActivityPlugin").then(({ LiveActivity }) => {
      LiveActivity.update({ remainingSeconds: remaining, mode, isRunning: false }).catch(() => {});
    }).catch(() => {});
  }, [mode, remaining]);

  const handleStop = useCallback(() => {
    if (mode === "focus" && sessionStartRef.current !== null) {
      const elapsed = modeDuration("focus", settings) - remaining;
      if (elapsed > 30) {
        const startedAt = sessionStartRef.current;
        addSession({
          startTime: startedAt,
          durationSeconds: elapsed,
          type: "focus",
        });
        sync.pushSession({
          dateKey: todayKey(),
          startTime: startedAt,
          durationSeconds: elapsed,
          isCompleted: false,
        });
      }
      sessionStartRef.current = null;
    }
    breakStartRef.current = null;
    setState("default");
    setRemaining(modeDuration(mode, settings));
    import("@/app/plugins/LiveActivityPlugin").then(({ LiveActivity }) => {
      LiveActivity.stop({ mode }).catch(() => {});
    }).catch(() => {});
  }, [mode, remaining, addSession, sync, settings]);

  const handleSkip = useCallback(() => {
    if (mode === "focus" && sessionStartRef.current !== null) {
      const elapsed = modeDuration("focus", settings) - remaining;
      if (elapsed > 30) {
        const startedAt = sessionStartRef.current;
        addSession({
          startTime: startedAt,
          durationSeconds: elapsed,
          type: "focus",
        });
        sync.pushSession({
          dateKey: todayKey(),
          startTime: startedAt,
          durationSeconds: elapsed,
          isCompleted: false,
        });
      }
      sessionStartRef.current = null;
    }
    breakStartRef.current = null;
    setMode("focus");
    setState("default");
    setRemaining(modeDuration("focus", settings));
  }, [mode, remaining, addSession, sync, settings]);

  const handleSignedIn = useCallback(async () => {
    await sync.refreshSession();
    lastSyncedUserRef.current = null;
  }, [sync]);

  const handleEditSession = useCallback(
    (original: SessionEntry, updated: SessionEntry) => {
      setPersisted((prev) => {
        const key = todayKey();
        const day = prev.byDate[key];
        if (!day) return prev;
        const sessions = (day.sessions ?? []).map((s) =>
          s.startTime === original.startTime &&
          s.durationSeconds === original.durationSeconds
            ? updated
            : s,
        );
        const focusSeconds = sessions
          .filter((s) => !s.type || s.type === "focus")
          .reduce((sum, s) => sum + s.durationSeconds, 0);
        return {
          ...prev,
          byDate: { ...prev.byDate, [key]: { ...day, sessions, focusSeconds } },
          totalFocusSeconds: (!original.type || original.type === "focus")
            ? prev.totalFocusSeconds - original.durationSeconds + updated.durationSeconds
            : prev.totalFocusSeconds,
        };
      });
      sync.editSession(original.startTime, updated.durationSeconds);
    },
    [sync],
  );

  const handleDeleteSession = useCallback(
    (session: SessionEntry) => {
      setPersisted((prev) => {
        const key = todayKey();
        const day = prev.byDate[key];
        if (!day) return prev;
        const sessions = (day.sessions ?? []).filter(
          (s) =>
            !(s.startTime === session.startTime &&
              s.durationSeconds === session.durationSeconds),
        );
        const wasCompleted = session.durationSeconds >= settings.focusDurationMinutes * 60;
        const focusSeconds = sessions
          .filter((s) => !s.type || s.type === "focus")
          .reduce((sum, s) => sum + s.durationSeconds, 0);
        return {
          ...prev,
          byDate: {
            ...prev.byDate,
            [key]: {
              ...day,
              sessions,
              focusSeconds,
              pomos: wasCompleted ? Math.max(0, day.pomos - 1) : day.pomos,
            },
          },
          totalFocusSeconds: (!session.type || session.type === "focus")
            ? prev.totalFocusSeconds - session.durationSeconds
            : prev.totalFocusSeconds,
          totalPomos: wasCompleted
            ? Math.max(0, prev.totalPomos - 1)
            : prev.totalPomos,
        };
      });
      sync.deleteSession(session.startTime);
    },
    [settings.focusDurationMinutes, sync],
  );

  const stats = statsFromPersisted(persisted);

  const currentSessionElapsed =
    mode === "focus" && state !== "default"
      ? modeDuration("focus", settings) - remaining
      : 0;

  return (
    <PomodoroScreen
      mode={mode}
      state={state}
      remaining={remaining}
      stats={stats}
      expanded={showStats}
      fullscreen={props.fullscreen}
      weeklyGoalMinutes={goals.weeklyGoalMinutes}
      currentSessionStart={sessionStartRef.current}
      currentSessionElapsed={currentSessionElapsed}
      simNow={simNow}
      userEmail={sync.email}
      syncStatus={sync.status}
      onPlay={handlePlay}
      onPause={handlePause}
      onStop={handleStop}
      onSkip={handleSkip}
      settings={settings}
      onSettingsChange={handleSettingsChange}
      onEditSession={handleEditSession}
      onDeleteSession={handleDeleteSession}
      onOpenStats={() => setShowStats(true)}
      onCloseStats={() => setShowStats(false)}
      onSignedIn={handleSignedIn}
    />
  );
}
