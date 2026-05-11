export type PomodoroMode = "focus" | "break";
export type PomodoroState = "default" | "running" | "paused";

export interface SessionEntry {
  startTime: number;
  durationSeconds: number;
}

export interface PomodoroStats {
  todayPomos: number;
  todayFocusMinutes: number;
  totalPomos: number;
  totalFocusMinutes: number;
  todaySessions: SessionEntry[];
}

export const FOCUS_DURATION_SECONDS = 25 * 60;
export const BREAK_DURATION_SECONDS = 5 * 60;

export function modeDuration(mode: PomodoroMode): number {
  return mode === "focus" ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS;
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
