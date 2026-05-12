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
  /** Focus minutes for each day of the current week, Sun=0..Sat=6. */
  weeklyFocusMinutes: number[];
}

export const FOCUS_DURATION_SECONDS = 25 * 60;
export const BREAK_DURATION_SECONDS = 5 * 60;

export const DEFAULT_WEEKLY_GOAL_MINUTES = 1050;
export const MAX_SUGGESTED_POMOS = 12;
const FOCUS_DURATION_MINUTES = FOCUS_DURATION_SECONDS / 60;

export interface AdaptiveTarget {
  /** Minutes per remaining day to hit the effective goal. */
  dailyTargetMinutes: number;
  /** Suggested pomos for today, capped at MAX_SUGGESTED_POMOS. */
  suggestedPomos: number;
  /** Today's day index (Sun=0..Sat=6). */
  todayDayIndex: number;
}

export function computeAdaptiveTarget(
  weeklyFocusMinutes: number[],
  weeklyGoalMinutes: number,
  carryoverMinutes: number,
  todayDayIndex: number,
): AdaptiveTarget {
  const completedMinutes = weeklyFocusMinutes.reduce((sum, m) => sum + m, 0);
  const effectiveGoal = weeklyGoalMinutes + carryoverMinutes;
  const remainingMinutes = Math.max(0, effectiveGoal - completedMinutes);
  const remainingDays = Math.max(1, 7 - todayDayIndex);
  const dailyTargetMinutes = remainingMinutes / remainingDays;
  const suggestedPomos = Math.min(
    MAX_SUGGESTED_POMOS,
    Math.ceil(dailyTargetMinutes / FOCUS_DURATION_MINUTES),
  );
  return { dailyTargetMinutes, suggestedPomos, todayDayIndex };
}

export function modeDuration(mode: PomodoroMode): number {
  return mode === "focus" ? FOCUS_DURATION_SECONDS : BREAK_DURATION_SECONDS;
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
