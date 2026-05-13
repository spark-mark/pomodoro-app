"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PomodoroScreen from "./PomodoroScreen";
import { useSync } from "./useSync";
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  DEFAULT_SETTINGS,
  FOCUS_DURATION_SECONDS,
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

interface PersistedGoals {
  weeklyGoalMinutes: number;
  /** Positive = deficit (work more), negative = surplus (work less). */
  carryoverMinutes: number;
  /** ISO week identifier (e.g., "2026-W20") of the most recent rollover check. */
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
    carryoverMinutes: 0,
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
      carryoverMinutes: parsed.carryoverMinutes ?? 0,
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

function previousWeekTotalMinutes(
  byDate: Record<string, PersistedDayEntry>,
  now: Date,
): number {
  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - now.getDay() - 7);
  let total = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const entry = byDate[dateKey(d)];
    if (entry) total += Math.floor(entry.focusSeconds / 60);
  }
  return total;
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
  return {
    todayPomos: day.pomos,
    todayFocusMinutes: Math.floor(day.focusSeconds / 60),
    totalPomos: p.totalPomos,
    totalFocusMinutes: Math.floor(p.totalFocusSeconds / 60),
    todaySessions: day.sessions ?? [],
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

  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [state, setState] = useState<PomodoroState>("default");
  const [remaining, setRemaining] = useState<number>(modeDuration("focus"));
  const [persisted, setPersisted] = useState<Persisted>({
    byDate: {},
    totalPomos: 0,
    totalFocusSeconds: 0,
  });
  const [goals, setGoals] = useState<PersistedGoals>({
    weeklyGoalMinutes: DEFAULT_WEEKLY_GOAL_MINUTES,
    carryoverMinutes: 0,
    lastWeekKey: "",
  });
  const [showStats, setShowStats] = useState<boolean>(false);
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);

  const sessionStartRef = useRef<number | null>(null);
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
    carryoverMinutes: 0,
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
      const prevTotal = previousWeekTotalMinutes(data.byDate, now);
      const prevEffectiveGoal =
        loadedGoals.weeklyGoalMinutes + loadedGoals.carryoverMinutes;
      const delta = prevEffectiveGoal - prevTotal;
      const maxCarryover = loadedGoals.weeklyGoalMinutes * 0.25;
      const clamped = Math.max(-maxCarryover, Math.min(maxCarryover, delta));
      nextGoals = {
        weeklyGoalMinutes: loadedGoals.weeklyGoalMinutes,
        carryoverMinutes: clamped,
        lastWeekKey: currentWeekKey,
      };
    }
    if (nextGoals !== loadedGoals) saveGoal(nextGoals);
    setGoals(nextGoals);

    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const loaded = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<PomodoroSettings> };
        setSettings(loaded);
        setRemaining(modeDuration("focus", loaded));
      }
    } catch { /* ignore */ }
  }, [storageKey]);

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
      }[] = [];
      for (const [dateKey, day] of Object.entries(localPersisted.byDate)) {
        const sessions = day.sessions ?? [];
        for (let i = 0; i < sessions.length; i++) {
          const se = sessions[i];
          localSessions.push({
            dateKey,
            startTime: se.startTime,
            durationSeconds: se.durationSeconds,
            isCompleted: se.durationSeconds >= FOCUS_DURATION_SECONDS,
          });
        }
      }

      if (localSessions.length > 0) {
        await s.bulkPushSessions(localSessions);
      }
      if (localGoals.lastWeekKey) {
        s.pushGoals({
          weeklyGoalMinutes: localGoals.weeklyGoalMinutes,
          carryoverMinutes: localGoals.carryoverMinutes,
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
                durationSeconds: settings.focusDurationMinutes * 60,
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
        durationSeconds: settings.focusDurationMinutes * 60,
        isCompleted: true,
      });
    }
  }, [sync]);

  useEffect(() => {
    if (state !== "running" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    const acquire = () => {
      navigator.wakeLock.request("screen").then((l) => { lock = l; }).catch(() => {});
    };
    acquire();
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !lock) acquire();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      lock?.release();
    };
  }, [state]);

  const lastTickRef = useRef<number | null>(null);
  useEffect(() => {
    if (state !== "running") {
      lastTickRef.current = null;
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
          if (mode === "focus") completeFocusSession();
          const nextMode: PomodoroMode = mode === "focus" ? "break" : "focus";
          setMode(nextMode);
          setState("default");
          return modeDuration(nextMode, settings);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [state, mode, speed, addFocusSeconds, completeFocusSession]);

  const handlePlay = useCallback(() => {
    if (mode === "focus" && state === "default") {
      sessionStartRef.current = simNowRef.current;
    }
    setState("running");
  }, [mode, state]);

  const handlePause = useCallback(() => setState("paused"), []);

  const handleStop = useCallback(() => {
    if (mode === "focus" && sessionStartRef.current !== null) {
      const elapsed = modeDuration("focus", settings) - remaining;
      if (elapsed > 0) {
        const startedAt = sessionStartRef.current;
        addSession({
          startTime: startedAt,
          durationSeconds: elapsed,
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
    setState("default");
    setRemaining(modeDuration(mode, settings));
  }, [mode, remaining, addSession, sync]);

  const handleSkip = useCallback(() => {
    if (mode === "focus" && sessionStartRef.current !== null) {
      const elapsed = modeDuration("focus", settings) - remaining;
      if (elapsed > 0) {
        const startedAt = sessionStartRef.current;
        addSession({
          startTime: startedAt,
          durationSeconds: elapsed,
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
    setMode("focus");
    setState("default");
    setRemaining(modeDuration("focus", settings));
  }, [mode, remaining, addSession, sync]);

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
        const focusSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
        return {
          ...prev,
          byDate: { ...prev.byDate, [key]: { ...day, sessions, focusSeconds } },
          totalFocusSeconds:
            prev.totalFocusSeconds - original.durationSeconds + updated.durationSeconds,
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
        const focusSeconds = sessions.reduce((sum, s) => sum + s.durationSeconds, 0);
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
          totalFocusSeconds: prev.totalFocusSeconds - session.durationSeconds,
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
      carryoverMinutes={goals.carryoverMinutes}
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
