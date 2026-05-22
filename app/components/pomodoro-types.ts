export type PomodoroMode = "focus" | "break" | "longBreak";
export type PomodoroState = "default" | "running" | "paused";

export interface SessionEntry {
  startTime: number;
  durationSeconds: number;
  type?: "focus" | "break" | "longBreak";
}

export interface PomodoroStats {
  todayPomos: number;
  todayFocusMinutes: number;
  totalPomos: number;
  totalFocusMinutes: number;
  todaySessions: SessionEntry[];
  /** Focus minutes for each day of the current week, Sun=0..Sat=6. */
  weeklyFocusMinutes: number[];
  /** Raw by-date data for computing arbitrary weeks. */
  byDate: Record<string, { focusSeconds: number }>;
}

export const FOCUS_DURATION_SECONDS = 25 * 60;
export const BREAK_DURATION_SECONDS = 5 * 60;

export const DEFAULT_WEEKLY_GOAL_MINUTES = 1260;
export const MAX_SUGGESTED_POMOS = 12;

export interface PomodoroSettings {
  dailyGoalHours: number;
  endOfDayHour: number;
  focusDurationMinutes: number;
  breakDurationMinutes: number;
  longBreakDurationMinutes: number;
  longBreakInterval: number;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
  dailyGoalHours: 3,
  endOfDayHour: 23,
  focusDurationMinutes: 25,
  breakDurationMinutes: 5,
  longBreakDurationMinutes: 15,
  longBreakInterval: 3,
};

export interface AdaptiveTarget {
  dailyTargetMinutes: number;
  suggestedPomos: number;
  todayDayIndex: number;
}

export function computeAdaptiveTarget(
  weeklyFocusMinutes: number[],
  weeklyGoalMinutes: number,
  todayDayIndex: number,
  settings: PomodoroSettings = DEFAULT_SETTINGS,
): AdaptiveTarget {
  const focusDurationMinutes = settings.focusDurationMinutes;
  const avgBreak = ((settings.longBreakInterval - 1) * settings.breakDurationMinutes + settings.longBreakDurationMinutes) / settings.longBreakInterval;
  const pomoCycleMinutes = focusDurationMinutes + avgBreak;

  const completedMinutes = weeklyFocusMinutes.reduce((sum, m) => sum + m, 0);
  const remainingMinutes = Math.max(0, weeklyGoalMinutes - completedMinutes);
  const remainingDays = Math.max(1, 7 - todayDayIndex);
  const dailyTargetMinutes = remainingMinutes / remainingDays;
  const goalPomos = Math.ceil(dailyTargetMinutes / focusDurationMinutes);

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const endMinutes = settings.endOfDayHour * 60;
  const minutesUntilEnd = Math.max(0, endMinutes - currentMinutes);
  const maxPomosByTime = Math.max(0, Math.floor(minutesUntilEnd / pomoCycleMinutes));

  const suggestedPomos = Math.min(MAX_SUGGESTED_POMOS, goalPomos, maxPomosByTime);
  return { dailyTargetMinutes, suggestedPomos, todayDayIndex };
}

export function modeDuration(mode: PomodoroMode, settings?: PomodoroSettings): number {
  const s = settings ?? DEFAULT_SETTINGS;
  if (mode === "focus") return s.focusDurationMinutes * 60;
  if (mode === "longBreak") return s.longBreakDurationMinutes * 60;
  return s.breakDurationMinutes * 60;
}

export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
