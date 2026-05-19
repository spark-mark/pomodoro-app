"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import StatBox from "./StatBox";
import { useSwipe } from "./useSwipe";
import type { SyncStatus } from "./useSync";
import {
  computeAdaptiveTarget,
  DEFAULT_SETTINGS,
  DEFAULT_WEEKLY_GOAL_MINUTES,
  FOCUS_DURATION_SECONDS,
  type AdaptiveTarget,
  type PomodoroSettings,
  type PomodoroStats,
  type SessionEntry,
} from "./pomodoro-types";

function NavHeader({ label, onPrev, onNext, disableNext }: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
  disableNext?: boolean;
}) {
  return (
    <div className="flex items-center gap-[2px]">
      <button
        type="button"
        onClick={onPrev}
        className="pressable-sm text-muted text-[16px] leading-none px-[4px]"
      >
        ‹
      </button>
      <span className="text-primary text-[13px] tracking-[-0.5px] min-w-[80px] text-center">
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        className="pressable-sm text-muted text-[16px] leading-none px-[4px]"
        style={{ opacity: disableNext ? 0.3 : 1 }}
        disabled={disableNext}
      >
        ›
      </button>
    </div>
  );
}

export interface StatsPanelProps {
  stats: PomodoroStats;
  weeklyGoalMinutes?: number;
  carryoverMinutes?: number;
  currentSessionStart?: number | null;
  currentSessionElapsed?: number;
  simNow?: number;
  userEmail?: string | null;
  syncStatus?: SyncStatus;
  onSignedIn?: () => void;
}

const SECONDS_PER_DAY = 24 * 60 * 60;

function hoursOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return (
    d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600
  );
}

interface MiniSessionTimelineProps {
  sessions: SessionEntry[];
  focusDurationSeconds: number;
  currentSessionStart: number | null;
  currentSessionElapsed: number;
  now: number;
}

function MiniSessionTimeline(props: MiniSessionTimelineProps) {
  const { sessions, focusDurationSeconds, currentSessionStart, currentSessionElapsed } = props;
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const hasScrolledRef = useRef(false);
  const scrollRef = useCallback((el: HTMLDivElement | null) => {
    scrollElRef.current = el;
    if (!el || hasScrolledRef.current) return;
    requestAnimationFrame(() => {
      if (hasScrolledRef.current) return;
      hasScrolledRef.current = true;
      const trackWidth = el.scrollWidth;
      const containerWidth = el.clientWidth;
      const playheadX = (hoursOfDay(Date.now()) / 24) * trackWidth;
      el.scrollLeft = playheadX - containerWidth / 2;
    });
  }, []);

  const [realNow, setRealNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setRealNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const nowHour = hoursOfDay(realNow);

  const inProgressStartHour =
    currentSessionStart !== null ? hoursOfDay(currentSessionStart) : 0;

  return (
    <div className="bg-surface h-[50px] rounded-[12px] overflow-hidden w-full relative" data-scrollable-x="">
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide h-full"
      >
        <div className="relative h-full" style={{ width: "480%" }}>
          {/* Hour markers */}
          {Array.from({ length: 25 }).map((_, h) => (
            <div
              key={`hm-${h}`}
              className="absolute top-[4px] h-[30px] border-l border-dotted border-[#8f92a9]/50"
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}

          {/* Completed session bars */}
          {sessions.map((session, i) => (
            <div
              key={`s-${i}`}
              className="absolute bg-primary rounded-[1px]"
              style={{
                left: `${(hoursOfDay(session.startTime) / 24) * 100}%`,
                top: "6px",
                width: `${(session.durationSeconds / SECONDS_PER_DAY) * 100}%`,
                height: "26px",
              }}
            />
          ))}

          {/* In-progress session: dashed outline (full planned width) + solid grow fill */}
          {currentSessionStart !== null && (
            <>
              <div
                className="absolute border border-dashed border-primary rounded-[1px] shadow-[0px_0px_14.9px_1px_rgba(194,201,220,0.67)]"
                style={{
                  left: `${(inProgressStartHour / 24) * 100}%`,
                  top: "6px",
                  width: `${(focusDurationSeconds / SECONDS_PER_DAY) * 100}%`,
                  height: "26px",
                }}
              />
              {currentSessionElapsed > 0 && (
                <div
                  className="absolute bg-primary rounded-[1px]"
                  style={{
                    left: `${(inProgressStartHour / 24) * 100}%`,
                    top: "6px",
                    width: `${(currentSessionElapsed / SECONDS_PER_DAY) * 100}%`,
                    height: "26px",
                  }}
                />
              )}
            </>
          )}

          {/* Playhead: red circle + vertical line */}
          <div
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: `${(nowHour / 24) * 100}%`,
              top: "2px",
              transform: "translateX(-50%)",
            }}
          >
            <div className="w-[6px] h-[6px] rounded-full bg-danger" />
            <div className="w-[1.5px] h-[28px] bg-danger" />
          </div>

          {/* Hour labels — kept same size at bottom */}
          {Array.from({ length: 24 }).map((_, h) => {
            const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const suffix = h < 12 ? "am" : "pm";
            return (
              <div
                key={`hl-${h}`}
                className="absolute text-muted text-[10px] tracking-[-0.5px] leading-none whitespace-nowrap"
                style={{
                  left: `${(h / 24) * 100}%`,
                  top: "37px",
                  transform: "translateX(-50%)",
                }}
              >
                {`${hr12}${suffix}`}
              </div>
            );
          })}
        </div>
      </div>
      {/* Edge fade overlays — z-10 to sit above playhead and all content */}
      <div
        className="absolute inset-y-0 left-0 w-[36px] z-10 pointer-events-none rounded-l-[12px]"
        style={{ background: "linear-gradient(to right, #d8d0ce, rgba(216,208,206,0))" }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[36px] z-10 pointer-events-none rounded-r-[12px]"
        style={{ background: "linear-gradient(to left, #d8d0ce, rgba(216,208,206,0))" }}
      />
    </div>
  );
}

/* ── Year heatmap ── */

function buildYearGrid(byDate: Record<string, { focusSeconds: number }>): number[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - (52 * 7 - 1) - dayOfWeek);

  const grid: number[][] = Array.from({ length: 7 }, () => Array(52).fill(0));

  const cursor = new Date(startDate);
  for (let col = 0; col < 52; col++) {
    for (let row = 0; row < 7; row++) {
      if (cursor > today) break;
      const y = cursor.getFullYear();
      const m = `${cursor.getMonth() + 1}`.padStart(2, "0");
      const d = `${cursor.getDate()}`.padStart(2, "0");
      const key = `${y}-${m}-${d}`;
      const entry = byDate[key];
      if (entry) grid[row][col] = Math.floor(entry.focusSeconds / 60);
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return grid;
}

const HEAT_COLORS = ["#cec1bf", "#b8b0c4", "#8f92a9", "#6b6f94", "#545b7f"];

function heatColor(minutes: number): string {
  if (minutes === 0) return HEAT_COLORS[0];
  if (minutes < 30) return HEAT_COLORS[1];
  if (minutes < 90) return HEAT_COLORS[2];
  if (minutes < 180) return HEAT_COLORS[3];
  return HEAT_COLORS[4];
}

function YearHeatmap({ byDate }: { byDate: Record<string, { focusSeconds: number }> }) {
  const grid = buildYearGrid(byDate);
  return (
    <div className="flex flex-col gap-[3px]">
      {Array.from({ length: 7 }).map((_, r) => (
        <div key={r} className="flex gap-[3px]">
          {Array.from({ length: 52 }).map((_, c) => (
            <div
              key={c}
              className="size-[5px] rounded-[1px]"
              style={{ backgroundColor: heatColor(grid[r][c]) }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Weekly section (bar chart + controls) ── */

const MAX_HOURS = 8;
const GRID_HOURS = [0, 2, 4, 6, 8];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function weekLabel(offset: number): string {
  if (offset === 0) return "This week";
  if (offset === -1) return "Last week";
  return `${Math.abs(offset)} weeks ago`;
}

const DASHED_AMBER_BORDER = "1.5px dashed #a98461";

function weekMinutesForOffset(
  byDate: Record<string, { focusSeconds: number }>,
  offset: number,
): number[] {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setHours(0, 0, 0, 0);
  sunday.setDate(now.getDate() - now.getDay() + offset * 7);
  const result = new Array<number>(7).fill(0);
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const dd = `${d.getDate()}`.padStart(2, "0");
    const key = `${y}-${m}-${dd}`;
    const entry = byDate[key];
    if (entry) result[i] = Math.floor(entry.focusSeconds / 60);
  }
  return result;
}

interface WeeklySectionProps {
  weeklyFocusMinutes: number[];
  adaptiveTarget: AdaptiveTarget;
  byDate: Record<string, { focusSeconds: number }>;
  settings?: PomodoroSettings;
}

function WeeklySection({
  weeklyFocusMinutes,
  adaptiveTarget,
  byDate,
  settings,
}: WeeklySectionProps) {
  const [weekOffset, setWeekOffset] = useState(0);

  const displayMinutes =
    weekOffset === 0
      ? weeklyFocusMinutes
      : weekMinutesForOffset(byDate, weekOffset);

  const days = DAY_LABELS.map((label, i) => ({
    label,
    hours: (displayMinutes[i] ?? 0) / 60,
  }));
  const dailyAverageMinutes = Math.round(
    displayMinutes.reduce((sum, m) => sum + m, 0) / 7,
  );
  const avgHours = dailyAverageMinutes / 60;
  const avgBottomPct = Math.min(1, avgHours / MAX_HOURS) * 100;
  const isCurrentWeek = weekOffset === 0;
  const todayDayIndex = isCurrentWeek ? adaptiveTarget.todayDayIndex : -1;
  const adaptiveDailyHours = adaptiveTarget.dailyTargetMinutes / 60;
  const targetPct = isCurrentWeek ? Math.min(1, adaptiveDailyHours / MAX_HOURS) * 100 : 0;

  const [tooltipDay, setTooltipDay] = useState<number | null>(null);

  const weekSwipe = useSwipe(
    () => setWeekOffset(Math.min(0, weekOffset + 1)),
    () => setWeekOffset(weekOffset - 1),
  );

  return (
    <div className="bg-surface rounded-[12px] p-[14px] flex flex-col gap-[12px]" {...weekSwipe}>
      {/* Header row: Daily Average + week nav */}
      <div className="flex items-end justify-between">
        <StatBox title="Daily Average" value={dailyAverageMinutes} format="time" />
        <NavHeader
          label={weekLabel(weekOffset)}
          onPrev={() => setWeekOffset(weekOffset - 1)}
          onNext={() => setWeekOffset(Math.min(0, weekOffset + 1))}
          disableNext={weekOffset === 0}
        />
      </div>

      {/* Bar chart — Y-axis left, avg label right */}
      <div className="flex">
        {/* Y-axis labels (left) */}
        <div className="relative h-[120px] w-[24px] shrink-0">
          {GRID_HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-[4px] text-[10px] text-muted tracking-[-0.5px] leading-none"
              style={{
                bottom: `${(h / MAX_HOURS) * 100}%`,
                transform: "translateY(50%)",
              }}
            >
              {h}h
            </div>
          ))}
        </div>
        {/* Chart area */}
        <div className="flex-1 min-w-0">
          <div className="relative h-[120px] w-full">
            {GRID_HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-[#8f92a9]/25"
                style={{ bottom: `${(h / MAX_HOURS) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end justify-between gap-[3px] px-[2px]">
              {days.map((d, i) => {
                const actualPct = Math.min(1, d.hours / MAX_HOURS) * 100;
                const isToday = isCurrentWeek && i === todayDayIndex;
                const isFuture = isCurrentWeek && i > todayDayIndex;
                const actualMin = Math.round(d.hours * 60);
                const targetMin = Math.round(adaptiveDailyHours * 60);
                const showTooltip = tooltipDay === i;
                return (
                  <div
                    key={i}
                    className="flex-1 relative h-full"
                    onClick={() => setTooltipDay(showTooltip ? null : i)}
                  >
                    {showTooltip && (actualMin > 0 || ((isToday || isFuture) && targetMin > 0)) && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 z-20 bg-accent text-white text-[10px] tracking-[-0.3px] rounded-[6px] px-[6px] py-[3px] whitespace-nowrap pointer-events-none"
                        style={{ bottom: `${Math.max(actualPct, targetPct) + 3}%` }}
                      >
                        {actualMin > 0 && <span>{Math.floor(actualMin / 60)}h{actualMin % 60 > 0 ? ` ${actualMin % 60}m` : ""}</span>}
                        {actualMin > 0 && (isToday || isFuture) && " / "}
                        {(isToday || isFuture) && <span>{Math.floor(targetMin / 60)}h{targetMin % 60 > 0 ? ` ${targetMin % 60}m` : ""}</span>}
                      </div>
                    )}
                    {!isFuture && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-primary rounded-[1px]"
                        style={{ height: `${actualPct}%` }}
                      />
                    )}
                    {(isToday || isFuture) && targetPct > actualPct && (
                      <div
                        className="absolute inset-x-0 rounded-[2px]"
                        style={{
                          bottom: `${actualPct}%`,
                          height: `${targetPct - actualPct}%`,
                          border: DASHED_AMBER_BORDER,
                          background: "transparent",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {/* Average line */}
            <div
              className="absolute left-0 right-0 border-t border-[#a98461]/60 pointer-events-none"
              style={{ bottom: `${avgBottomPct}%` }}
            />
          </div>
          <div className="flex items-start justify-between mt-1 px-[2px]">
            {DAY_LABELS.map((label, i) => (
              <span
                key={i}
                className="text-[11px] text-[#8f92a9]/70 tracking-[-0.3px] flex-1 text-center"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
        {/* Avg label (right) */}
        <div className="relative h-[120px] w-[24px] shrink-0">
          {avgBottomPct > 0 && (
            <div
              className="absolute left-[4px] text-[10px] text-accent tracking-[-0.3px] leading-none"
              style={{
                bottom: `${avgBottomPct}%`,
                transform: "translateY(50%)",
              }}
            >
              avg
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export interface StatsPanelDragZoneProps {
  stats: PomodoroStats;
  currentSessionStart?: number | null;
  currentSessionElapsed?: number;
  simNow?: number;
  focusDurationMinutes?: number;
  weeklyGoalMinutes?: number;
  carryoverMinutes?: number;
  settings?: PomodoroSettings;
}

export function StatsPanelDragZone({
  stats,
  currentSessionStart = null,
  currentSessionElapsed = 0,
  simNow,
  focusDurationMinutes = 25,
  weeklyGoalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES,
  carryoverMinutes = 0,
  settings = DEFAULT_SETTINGS,
}: StatsPanelDragZoneProps) {
  const target = computeAdaptiveTarget(
    stats.weeklyFocusMinutes,
    weeklyGoalMinutes,
    carryoverMinutes,
    new Date().getDay(),
    settings,
  );
  const remainingPomos = Math.max(0, target.suggestedPomos - stats.todayPomos);
  const totalSquares = stats.todayPomos + remainingPomos;

  return (
    <div className="px-[18px] pb-[12px] flex flex-col gap-[12px]">
      <MiniSessionTimeline
        sessions={stats.todaySessions}
        focusDurationSeconds={focusDurationMinutes * 60}
        currentSessionStart={currentSessionStart}
        currentSessionElapsed={currentSessionElapsed}
        now={simNow ?? Date.now()}
      />
      <div className="grid grid-cols-2 gap-[12px]">
        <div className="bg-surface rounded-[12px] p-[14px] flex flex-col gap-[8px] items-start">
          <p className="text-muted text-[15px] tracking-[-0.84px]">
            Today&apos;s Pomos
          </p>
          <div className="flex flex-wrap gap-[5px] items-center min-h-[37px]">
            {totalSquares > 0 ? (
              <>
                {Array.from({ length: stats.todayPomos }).map((_, i) => (
                  <div
                    key={`s-${i}`}
                    className="size-[18px] rounded-[2px] bg-primary"
                  />
                ))}
                {Array.from({ length: remainingPomos }).map((_, i) => (
                  <div
                    key={`d-${i}`}
                    className="size-[18px] rounded-[2px]"
                    style={{
                      border: "1.5px dashed #a98461",
                      background: "transparent",
                    }}
                  />
                ))}
              </>
            ) : (
              <p className="text-primary text-[30px] tracking-[-1.5px] leading-none">
                None
              </p>
            )}
          </div>
        </div>
        <div className="bg-surface rounded-[12px] p-[14px]">
          <StatBox
            title="Today's Focus"
            value={stats.todayFocusMinutes}
            format="time"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Focus Log ── */

function formatTime12(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const m = d.getMinutes();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function dayLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === -1) return "Yesterday";
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function dateKeyForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const dd = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface FocusLogProps {
  sessions: SessionEntry[];
  byDate: Record<string, { focusSeconds: number; sessions?: SessionEntry[] }>;
  onEdit?: (original: SessionEntry, updated: SessionEntry) => void;
  onDelete?: (session: SessionEntry) => void;
}

function FocusLog({ sessions: todaySessions, byDate, onEdit, onDelete }: FocusLogProps) {
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editMinutes, setEditMinutes] = useState(0);

  const isToday = dayOffset === 0;
  const currentDateKey = dateKeyForOffset(dayOffset);
  const allDaySessions = isToday
    ? todaySessions
    : (byDate[currentDateKey] as { sessions?: SessionEntry[] })?.sessions ?? [];
  const daySessions = allDaySessions.filter((s) => !s.type || s.type === "focus");

  const sorted = [...daySessions].sort((a, b) => b.startTime - a.startTime);

  const daySwipe = useSwipe(
    () => { setDayOffset(Math.min(0, dayOffset + 1)); setSelectedIdx(null); setEditingIdx(null); },
    () => { setDayOffset(dayOffset - 1); setSelectedIdx(null); setEditingIdx(null); },
  );

  return (
    <div className="bg-surface rounded-[12px] p-[14px] flex flex-col gap-[8px]" {...daySwipe}>
      <div className="flex items-center justify-between">
        <p className="text-muted text-[15px] tracking-[-0.84px]">
          Focus Log
        </p>
        <NavHeader
          label={dayLabel(dayOffset)}
          onPrev={() => { setDayOffset(dayOffset - 1); setSelectedIdx(null); setEditingIdx(null); }}
          onNext={() => { setDayOffset(Math.min(0, dayOffset + 1)); setSelectedIdx(null); setEditingIdx(null); }}
          disableNext={dayOffset === 0}
        />
      </div>
      <div className="flex flex-col">
        {sorted.map((s, i) => {
          const endTime = s.startTime + s.durationSeconds * 1000;
          const isCompleted = s.durationSeconds >= FOCUS_DURATION_SECONDS;
          const isSelected = selectedIdx === i;
          const isEditing = editingIdx === i;
          return (
            <div key={`fl-${i}`} className="flex flex-col">
              <div
                className="flex items-stretch"
                onClick={() => {
                  if (isSelected) {
                    setSelectedIdx(null);
                    setEditingIdx(null);
                  } else {
                    setSelectedIdx(i);
                    setEditingIdx(null);
                  }
                }}
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center w-[24px] shrink-0 relative">
                  <div
                    className="size-[8px] rounded-full mt-[6px] shrink-0 z-10"
                    style={{
                      backgroundColor: isCompleted ? "#545b7f" : "#a98461",
                    }}
                  />
                  {i < sorted.length - 1 && (
                    <div className="w-[1.5px] bg-[#c2c9dc]/60 absolute top-[10px] bottom-[-6px]" />
                  )}
                </div>
                {/* Content */}
                <div className="flex items-center justify-between flex-1 min-w-0 pb-[14px] pl-[8px]">
                  <span className="text-primary text-[13px] tracking-[-0.5px]">
                    {formatTime12(s.startTime)} – {formatTime12(endTime)}
                  </span>
                  <span className="text-muted text-[13px] tracking-[-0.5px]">
                    {formatDuration(s.durationSeconds)}
                  </span>
                </div>
              </div>
              {isSelected && !isEditing && isToday && (
                <div className="flex gap-[8px] pl-[32px] pb-[12px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingIdx(i);
                      setEditMinutes(Math.round(s.durationSeconds / 60));
                    }}
                    className="pressable-sm text-primary text-[12px] tracking-[-0.5px] bg-[#cec1bf]/50 rounded-[8px] px-[10px] py-[5px]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.(s);
                      setSelectedIdx(null);
                    }}
                    className="pressable-sm text-danger text-[12px] tracking-[-0.5px] bg-[#c65c5c]/10 rounded-[8px] px-[10px] py-[5px]"
                  >
                    Delete
                  </button>
                </div>
              )}
              {isEditing && (
                <div
                  className="flex items-center gap-[8px] pl-[32px] pb-[12px]"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => setEditMinutes(Math.max(1, editMinutes - 5))}
                    className="pressable-sm size-[24px] rounded-full bg-[#cec1bf]/60 text-primary text-[14px] flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-primary text-[13px] tracking-[-0.5px] min-w-[36px] text-center tabular-nums">
                    {editMinutes}m
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditMinutes(Math.min(480, editMinutes + 5))}
                    className="pressable-sm size-[24px] rounded-full bg-[#cec1bf]/60 text-primary text-[14px] flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onEdit?.(s, { ...s, durationSeconds: editMinutes * 60 });
                      setEditingIdx(null);
                      setSelectedIdx(null);
                    }}
                    className="pressable-sm text-inverse text-[12px] tracking-[-0.5px] bg-primary rounded-[8px] px-[10px] py-[5px] ml-auto"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="text-muted text-[13px] tracking-[-0.5px] py-[8px]">
            No sessions
          </p>
        )}
      </div>
    </div>
  );
}

export interface StatsPanelScrollableProps {
  stats: PomodoroStats;
  weeklyGoalMinutes?: number;
  carryoverMinutes?: number;
  userEmail?: string | null;
  syncStatus?: SyncStatus;
  onSignedIn?: () => void;
  settings?: PomodoroSettings;
  onEditSession?: (original: SessionEntry, updated: SessionEntry) => void;
  onDeleteSession?: (session: SessionEntry) => void;
}

export function StatsPanelScrollable({
  stats,
  weeklyGoalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES,
  carryoverMinutes = 0,
  userEmail = null,
  syncStatus = "idle",
  onSignedIn,
  settings = DEFAULT_SETTINGS,
  onEditSession,
  onDeleteSession,
}: StatsPanelScrollableProps) {
  const target = computeAdaptiveTarget(
    stats.weeklyFocusMinutes,
    weeklyGoalMinutes,
    carryoverMinutes,
    new Date().getDay(),
    settings,
  );

  return (
    <div className="px-[18px] pb-[32px] flex flex-col gap-[12px]">
      {/* ── Lifetime ── */}
      <div className="grid grid-cols-2 gap-[12px]">
        <div className="bg-surface rounded-[12px] p-[14px]">
          <StatBox title="Total Pomos" value={stats.totalPomos} />
        </div>
        <div className="bg-surface rounded-[12px] p-[14px]">
          <StatBox
            title="Total Focus Duration"
            value={stats.totalFocusMinutes}
            format="time"
          />
        </div>
      </div>

      {/* ── Weekly ── */}
      <WeeklySection
        weeklyFocusMinutes={stats.weeklyFocusMinutes}
        adaptiveTarget={target}
        byDate={stats.byDate}
        settings={settings}
      />
      <div className="bg-surface rounded-[12px] p-[14px] flex flex-col gap-[8px]">
        <p className="text-muted text-[15px] tracking-[-0.84px]">
          Year Overview
        </p>
        <YearHeatmap byDate={stats.byDate} />
      </div>

      {/* ── Focus Log ── */}
      <FocusLog sessions={stats.todaySessions} byDate={stats.byDate} onEdit={onEditSession} onDelete={onDeleteSession} />

    </div>
  );
}

export default function StatsPanel(props: StatsPanelProps) {
  return (
    <>
      <StatsPanelDragZone
        stats={props.stats}
        currentSessionStart={props.currentSessionStart}
        currentSessionElapsed={props.currentSessionElapsed}
        simNow={props.simNow}
      />
      <StatsPanelScrollable
        stats={props.stats}
        weeklyGoalMinutes={props.weeklyGoalMinutes}
        carryoverMinutes={props.carryoverMinutes}
        userEmail={props.userEmail}
        syncStatus={props.syncStatus}
        onSignedIn={props.onSignedIn}
      />
    </>
  );
}
