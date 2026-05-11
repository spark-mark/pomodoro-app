"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PomodoroScreen from "./PomodoroScreen";
import {
  FOCUS_DURATION_SECONDS,
  modeDuration,
  type PomodoroMode,
  type PomodoroState,
  type PomodoroStats,
  type SessionEntry,
} from "./pomodoro-types";

const STORAGE_KEY = "pomodoro-mobile.v1";

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

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
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
  };
}

export interface InteractivePomodoroProps {
  /**
   * Optional override of the localStorage key. Use a distinct key for the
   * canvas storyboard so that experimenting on the canvas does not stomp the
   * user's real persisted stats.
   */
  storageKey?: string;
  /**
   * Optional speed multiplier for the timer tick. Defaults to 1 (real time).
   * Pass e.g. 30 to make 1 second of wall-clock advance the timer by 30
   * seconds — useful for the canvas storyboard to demo the full flow quickly.
   */
  speed?: number;
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
  const [showStats, setShowStats] = useState<boolean>(false);

  const sessionStartRef = useRef<number | null>(null);
  const simNowRef = useRef<number>(Date.now());
  const [simNow, setSimNow] = useState<number>(Date.now());

  useEffect(() => {
    setPersisted(loadPersisted(storageKey));
  }, [storageKey]);

  useEffect(() => {
    savePersisted(storageKey, persisted);
  }, [persisted, storageKey]);

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
    setPersisted((prev) => {
      const key = todayKey();
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
                durationSeconds: FOCUS_DURATION_SECONDS,
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
  }, []);

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
          return modeDuration(nextMode);
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
      const elapsed = modeDuration("focus") - remaining;
      if (elapsed > 0) {
        addSession({
          startTime: sessionStartRef.current,
          durationSeconds: elapsed,
        });
      }
      sessionStartRef.current = null;
    }
    setState("default");
    setRemaining(modeDuration(mode));
  }, [mode, remaining, addSession]);

  const handleSkip = useCallback(() => {
    if (mode === "focus" && sessionStartRef.current !== null) {
      const elapsed = modeDuration("focus") - remaining;
      if (elapsed > 0) {
        addSession({
          startTime: sessionStartRef.current,
          durationSeconds: elapsed,
        });
      }
      sessionStartRef.current = null;
    }
    setMode("focus");
    setState("default");
    setRemaining(modeDuration("focus"));
  }, [mode, remaining, addSession]);

  const stats = statsFromPersisted(persisted);

  const currentSessionElapsed =
    mode === "focus" && state !== "default"
      ? modeDuration("focus") - remaining
      : 0;

  return (
    <PomodoroScreen
      mode={mode}
      state={state}
      remaining={remaining}
      stats={stats}
      expanded={showStats}
      currentSessionStart={sessionStartRef.current}
      currentSessionElapsed={currentSessionElapsed}
      simNow={simNow}
      onPlay={handlePlay}
      onPause={handlePause}
      onStop={handleStop}
      onSkip={handleSkip}
      onOpenStats={() => setShowStats(true)}
      onCloseStats={() => setShowStats(false)}
    />
  );
}
