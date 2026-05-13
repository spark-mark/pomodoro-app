"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { SessionEntry } from "./pomodoro-types";

export type SyncStatus = "idle" | "syncing" | "synced" | "error";

interface ServerSession {
  dateKey: string;
  startTime: number;
  durationSeconds: number;
  isCompleted: boolean;
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

interface ServerGoals {
  weeklyGoalMinutes: number;
  carryoverMinutes: number;
  lastWeekKey: string;
}

export interface SyncResult {
  persisted: Persisted;
  goals: ServerGoals | null;
}

export interface UseSyncReturn {
  status: SyncStatus;
  email: string | null;
  authed: boolean;
  /** Returns true when a server payload was successfully loaded. */
  sync: () => Promise<SyncResult | null>;
  /** Fire-and-forget POST of a single completed/partial session. */
  pushSession: (s: ServerSession) => void;
  /** Fire-and-forget PUT of the user's goal state. */
  pushGoals: (g: ServerGoals) => void;
  /** Push all local sessions in one bulk request (used on first sign-in). */
  bulkPushSessions: (sessions: ServerSession[]) => Promise<void>;
  /** Fire-and-forget DELETE of a session by startTime. */
  deleteSession: (startTime: number) => void;
  /** Fire-and-forget PATCH of a session's duration by startTime. */
  editSession: (startTime: number, durationSeconds: number) => void;
  /** Force-refresh the next-auth session (call after signIn). */
  refreshSession: () => Promise<void>;
}

export function useSync(): UseSyncReturn {
  const { data, status: sessionStatus, update: updateSession } = useSession();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const inflightRef = useRef(false);

  const email = data?.user?.email ?? null;
  const authed = sessionStatus === "authenticated" && Boolean(email);

  const refreshSession = useCallback(async () => {
    await updateSession();
  }, [updateSession]);

  const sync = useCallback(async (): Promise<SyncResult | null> => {
    if (!authed) return null;
    if (inflightRef.current) return null;
    inflightRef.current = true;
    setStatus("syncing");
    try {
      const [sessionsRes, goalsRes] = await Promise.all([
        fetch("/api/sessions"),
        fetch("/api/goals"),
      ]);
      if (!sessionsRes.ok || !goalsRes.ok) {
        throw new Error("Sync failed");
      }
      const sessionsJson = (await sessionsRes.json()) as {
        sessions: ServerSession[];
      };
      const goalsJson = (await goalsRes.json()) as {
        goals: ServerGoals | null;
      };

      const persisted: Persisted = {
        byDate: {},
        totalPomos: 0,
        totalFocusSeconds: 0,
      };
      for (const s of sessionsJson.sessions) {
        const day = persisted.byDate[s.dateKey] ?? {
          pomos: 0,
          focusSeconds: 0,
          sessions: [],
        };
        day.sessions.push({
          startTime: s.startTime,
          durationSeconds: s.durationSeconds,
        });
        day.focusSeconds += s.durationSeconds;
        if (s.isCompleted) day.pomos += 1;
        persisted.byDate[s.dateKey] = day;
        persisted.totalFocusSeconds += s.durationSeconds;
        if (s.isCompleted) persisted.totalPomos += 1;
      }

      setStatus("synced");
      return { persisted, goals: goalsJson.goals };
    } catch {
      setStatus("error");
      return null;
    } finally {
      inflightRef.current = false;
    }
  }, [authed]);

  const pushSession = useCallback(
    (s: ServerSession) => {
      if (!authed) return;
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
        keepalive: true,
      }).catch(() => {
        /* ignore network failures — localStorage is the source of truth */
      });
    },
    [authed],
  );

  const pushGoals = useCallback(
    (g: ServerGoals) => {
      if (!authed) return;
      fetch("/api/goals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(g),
        keepalive: true,
      }).catch(() => {
        /* ignore */
      });
    },
    [authed],
  );

  const bulkPushSessions = useCallback(
    async (sessions: ServerSession[]) => {
      if (!authed || sessions.length === 0) return;
      try {
        await fetch("/api/sessions/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessions }),
        });
      } catch {
        /* ignore */
      }
    },
    [authed],
  );

  const deleteSession = useCallback(
    (startTime: number) => {
      if (!authed) return;
      fetch(`/api/sessions/${startTime}`, {
        method: "DELETE",
        keepalive: true,
      }).catch(() => {});
    },
    [authed],
  );

  const editSession = useCallback(
    (startTime: number, durationSeconds: number) => {
      if (!authed) return;
      fetch(`/api/sessions/${startTime}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationSeconds }),
        keepalive: true,
      }).catch(() => {});
    },
    [authed],
  );

  useEffect(() => {
    if (sessionStatus === "unauthenticated") setStatus("idle");
  }, [sessionStatus]);

  return {
    status,
    email,
    authed,
    sync,
    pushSession,
    pushGoals,
    bulkPushSessions,
    deleteSession,
    editSession,
    refreshSession,
  };
}
