"use client";

import { useEffect, useRef, useState } from "react";
import StatBox from "./StatBox";
import { AccountSection } from "./AuthUI";
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  const [realNow, setRealNow] = useState(Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setRealNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const nowHour = hoursOfDay(realNow);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const trackWidth = container.scrollWidth;
    const containerWidth = container.clientWidth;
    const playheadX = (nowHour / 24) * trackWidth;
    container.scrollLeft = playheadX - containerWidth / 2;
    hasScrolledRef.current = true;
  }, [nowHour]);

  const inProgressStartHour =
    currentSessionStart !== null ? hoursOfDay(currentSessionStart) : 0;

  return (
    <div className="bg-[#cec1bf] h-[100px] rounded-[18px] overflow-hidden w-full relative" data-scrollable-x="">
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide h-full"
      >
        <div className="relative h-full" style={{ width: "480%" }}>
          {/* Hour markers (25 dotted vertical lines, 0–24) */}
          {Array.from({ length: 25 }).map((_, h) => (
            <div
              key={`hm-${h}`}
              className="absolute top-[17px] h-[58px] border-l border-dotted border-[#8f92a9]/50"
              style={{ left: `${(h / 24) * 100}%` }}
            />
          ))}

          {/* Completed session bars */}
          {sessions.map((session, i) => (
            <div
              key={`s-${i}`}
              className="absolute bg-[#545b7f] rounded-[4px]"
              style={{
                left: `${(hoursOfDay(session.startTime) / 24) * 100}%`,
                top: "22px",
                width: `${(session.durationSeconds / SECONDS_PER_DAY) * 100}%`,
                height: "47px",
              }}
            />
          ))}

          {/* In-progress session: dashed outline (full planned width) + solid grow fill */}
          {currentSessionStart !== null && (
            <>
              <div
                className="absolute border border-dashed border-[#545b7f] rounded-[4px] shadow-[0px_0px_14.9px_1px_rgba(194,201,220,0.67)]"
                style={{
                  left: `${(inProgressStartHour / 24) * 100}%`,
                  top: "22px",
                  width: `${(focusDurationSeconds / SECONDS_PER_DAY) * 100}%`,
                  height: "47px",
                }}
              />
              {currentSessionElapsed > 0 && (
                <div
                  className="absolute bg-[#545b7f] rounded-[4px]"
                  style={{
                    left: `${(inProgressStartHour / 24) * 100}%`,
                    top: "22px",
                    width: `${(currentSessionElapsed / SECONDS_PER_DAY) * 100}%`,
                    height: "47px",
                  }}
                />
              )}
            </>
          )}

          {/* Playhead: red circle + vertical line at current simulated time */}
          <div
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: `${(nowHour / 24) * 100}%`,
              top: "12px",
              transform: "translateX(-50%)",
            }}
          >
            <div className="w-[8px] h-[8px] rounded-full bg-[#c65c5c]" />
            <div className="w-[2px] h-[55px] bg-[#c65c5c]" />
          </div>

          {/* Hour labels — centered under each hour marker line */}
          {Array.from({ length: 24 }).map((_, h) => {
            const hr12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
            const suffix = h < 12 ? "am" : "pm";
            return (
              <div
                key={`hl-${h}`}
                className="absolute text-[#8f92a9] text-[10px] tracking-[-0.5px] leading-none whitespace-nowrap"
                style={{
                  left: `${(h / 24) * 100}%`,
                  top: "82px",
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
        className="absolute inset-y-0 left-0 w-[36px] z-10 pointer-events-none rounded-l-[18px]"
        style={{ background: "linear-gradient(to right, #cec1bf, rgba(206,193,191,0))" }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[36px] z-10 pointer-events-none rounded-r-[18px]"
        style={{ background: "linear-gradient(to left, #cec1bf, rgba(206,193,191,0))" }}
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

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  const focusMin = settings?.focusDurationMinutes ?? 25;

  const todayDoneMinutes = isCurrentWeek ? (displayMinutes[todayDayIndex] ?? 0) : 0;
  const todayCappedMinutes = adaptiveTarget.suggestedPomos * focusMin;
  const todayTargetHours = (todayDoneMinutes + todayCappedMinutes) / 60;
  const todayTargetPct = isCurrentWeek ? Math.min(1, todayTargetHours / MAX_HOURS) * 100 : 0;

  const dailyGoalHours = settings?.dailyGoalHours ?? 3;
  const futureTargetPct = isCurrentWeek ? Math.min(1, dailyGoalHours / MAX_HOURS) * 100 : 0;

  const [tooltipDay, setTooltipDay] = useState<number | null>(null);

  return (
    <div className="flex flex-col gap-[12px]">
      {/* Header row: Daily Average + week nav */}
      <div className="flex items-end justify-between">
        <StatBox title="Daily Average" value={dailyAverageMinutes} format="time" />
        <div className="flex items-center gap-[2px]">
          <button
            type="button"
            onClick={() => setWeekOffset(weekOffset - 1)}
            className="pressable-sm text-[#8f92a9] text-[14px] leading-none"
          >
            ‹
          </button>
          <span className="text-[#545b7f] text-[12px] tracking-[-0.5px] min-w-[64px] text-center">
            {weekLabel(weekOffset)}
          </span>
          <button
            type="button"
            onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))}
            className="pressable-sm text-[#8f92a9] text-[14px] leading-none"
            style={{ opacity: weekOffset === 0 ? 0.3 : 1 }}
            disabled={weekOffset === 0}
          >
            ›
          </button>
        </div>
      </div>

      {/* Bar chart with Y-axis labels */}
      <div className="flex">
        <div className="relative h-[120px] w-[24px] shrink-0">
          {GRID_HOURS.map((h) => (
            <div
              key={h}
              className="absolute right-[4px] text-[10px] text-[#8f92a9] tracking-[-0.5px] leading-none"
              style={{
                bottom: `${(h / MAX_HOURS) * 100}%`,
                transform: "translateY(50%)",
              }}
            >
              {h}h
            </div>
          ))}
        </div>
        <div className="flex-1 min-w-0">
          <div className="relative h-[120px] w-full">
            {GRID_HOURS.map((h) => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-dotted border-[#8f92a9]/40"
                style={{ bottom: `${(h / MAX_HOURS) * 100}%` }}
              />
            ))}
            <div className="absolute inset-0 flex items-end justify-between gap-[6px] px-[2px]">
              {days.map((d, i) => {
                const actualPct = Math.min(1, d.hours / MAX_HOURS) * 100;
                const isToday = i === todayDayIndex;
                const isFuture = i > todayDayIndex;
                const barTargetHours = isToday ? todayTargetHours : dailyGoalHours;
                const actualMin = Math.round(d.hours * 60);
                const targetMin = Math.round(barTargetHours * 60);
                const showTooltip = tooltipDay === i;
                return (
                  <div
                    key={d.label}
                    className="flex-1 relative h-full"
                    onClick={() => setTooltipDay(showTooltip ? null : i)}
                  >
                    {showTooltip && (actualMin > 0 || ((isToday || isFuture) && targetMin > 0)) && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 z-20 bg-[#a98461] text-white text-[10px] tracking-[-0.3px] rounded-[6px] px-[6px] py-[3px] whitespace-nowrap pointer-events-none"
                        style={{ bottom: `${Math.max(actualPct, isToday ? todayTargetPct : futureTargetPct) + 3}%` }}
                      >
                        {actualMin > 0 && <span>{Math.floor(actualMin / 60)}h{actualMin % 60 > 0 ? ` ${actualMin % 60}m` : ""}</span>}
                        {actualMin > 0 && (isToday || isFuture) && " / "}
                        {(isToday || isFuture) && <span>{Math.floor(targetMin / 60)}h{targetMin % 60 > 0 ? ` ${targetMin % 60}m` : ""}</span>}
                      </div>
                    )}
                    {!isFuture && (
                      <div
                        className="absolute inset-x-0 bottom-0 bg-[#545b7f] rounded-[3px]"
                        style={{ height: `${actualPct}%` }}
                      />
                    )}
                    {isToday && todayTargetPct > actualPct && (
                      <div
                        className="absolute inset-x-0 rounded-[3px]"
                        style={{
                          bottom: `${actualPct}%`,
                          height: `${todayTargetPct - actualPct}%`,
                          border: DASHED_AMBER_BORDER,
                          background: "transparent",
                        }}
                      />
                    )}
                    {isFuture && futureTargetPct > 0 && (
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-[3px]"
                        style={{
                          height: `${futureTargetPct}%`,
                          border: DASHED_AMBER_BORDER,
                          background: "transparent",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div
              className="absolute left-0 right-0 border-t border-[#a98461]/60"
              style={{ bottom: `${avgBottomPct}%` }}
            />
          </div>
          <div className="flex items-start justify-between mt-1 px-[2px]">
            {days.map((d) => (
              <span
                key={d.label}
                className="text-[11px] text-[#8f92a9] tracking-[-0.5px] flex-1 text-center"
              >
                {d.label}
              </span>
            ))}
          </div>
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
}

export function StatsPanelDragZone({
  stats,
  currentSessionStart = null,
  currentSessionElapsed = 0,
  simNow,
  focusDurationMinutes = 25,
}: StatsPanelDragZoneProps) {
  return (
    <div className="px-[18px] pb-[12px]">
      <MiniSessionTimeline
        sessions={stats.todaySessions}
        focusDurationSeconds={focusDurationMinutes * 60}
        currentSessionStart={currentSessionStart}
        currentSessionElapsed={currentSessionElapsed}
        now={simNow ?? Date.now()}
      />
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

interface FocusLogProps {
  sessions: SessionEntry[];
  onEdit?: (original: SessionEntry, updated: SessionEntry) => void;
  onDelete?: (session: SessionEntry) => void;
}

function FocusLog({ sessions, onEdit, onDelete }: FocusLogProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editMinutes, setEditMinutes] = useState(0);

  if (sessions.length === 0) return null;

  const sorted = [...sessions].sort((a, b) => b.startTime - a.startTime);

  return (
    <div className="flex flex-col gap-[8px]">
      <p className="text-[#8f92a9] text-[14px] tracking-[-0.84px]">
        Focus Log
      </p>
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
                  <span className="text-[#545b7f] text-[13px] tracking-[-0.5px]">
                    {formatTime12(s.startTime)} – {formatTime12(endTime)}
                  </span>
                  <span className="text-[#8f92a9] text-[13px] tracking-[-0.5px]">
                    {formatDuration(s.durationSeconds)}
                  </span>
                </div>
              </div>
              {isSelected && !isEditing && (
                <div className="flex gap-[8px] pl-[32px] pb-[12px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingIdx(i);
                      setEditMinutes(Math.round(s.durationSeconds / 60));
                    }}
                    className="pressable-sm text-[#545b7f] text-[12px] tracking-[-0.5px] bg-[#cec1bf]/50 rounded-[8px] px-[10px] py-[5px]"
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
                    className="pressable-sm text-[#c65c5c] text-[12px] tracking-[-0.5px] bg-[#c65c5c]/10 rounded-[8px] px-[10px] py-[5px]"
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
                    className="pressable-sm size-[24px] rounded-full bg-[#cec1bf]/60 text-[#545b7f] text-[14px] flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-[#545b7f] text-[13px] tracking-[-0.5px] min-w-[36px] text-center tabular-nums">
                    {editMinutes}m
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditMinutes(Math.min(480, editMinutes + 5))}
                    className="pressable-sm size-[24px] rounded-full bg-[#cec1bf]/60 text-[#545b7f] text-[14px] flex items-center justify-center"
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
                    className="pressable-sm text-[#e6e1e0] text-[12px] tracking-[-0.5px] bg-[#545b7f] rounded-[8px] px-[10px] py-[5px] ml-auto"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
          );
        })}
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

  const remainingPomos = Math.max(0, target.suggestedPomos - stats.todayPomos);
  const totalSquares = stats.todayPomos + remainingPomos;

  return (
    <div className="px-[18px] pb-[32px] flex flex-col gap-[24px]">
      {/* ── Daily ── */}
      <div className="grid grid-cols-2 gap-[10px]">
        <div className="flex flex-col gap-[8px] items-start">
          <p className="text-[#8f92a9] text-[14px] tracking-[-0.84px]">
            Today&apos;s Pomos
          </p>
          <div className="flex flex-wrap gap-[5px] items-center min-h-[37px]">
            {totalSquares > 0 ? (
              <>
                {Array.from({ length: stats.todayPomos }).map((_, i) => (
                  <div
                    key={`s-${i}`}
                    className="size-[18px] rounded-[4px] bg-[#545b7f]"
                  />
                ))}
                {Array.from({ length: remainingPomos }).map((_, i) => (
                  <div
                    key={`d-${i}`}
                    className="size-[18px] rounded-[4px]"
                    style={{
                      border: "1.5px dashed #a98461",
                      background: "transparent",
                    }}
                  />
                ))}
              </>
            ) : (
              <p className="text-[#545b7f] text-[30px] tracking-[-1.5px] leading-none">
                None
              </p>
            )}
          </div>
        </div>
        <StatBox
          title="Today's Focus"
          value={stats.todayFocusMinutes}
          format="time"
        />
      </div>

      {/* ── Weekly ── */}
      <WeeklySection
        weeklyFocusMinutes={stats.weeklyFocusMinutes}
        adaptiveTarget={target}
        byDate={stats.byDate}
        settings={settings}
      />

      {/* ── Lifetime ── */}
      <div className="flex flex-col gap-[16px]">
        <div className="grid grid-cols-2 gap-[10px]">
          <StatBox title="Total Pomos" value={stats.totalPomos} />
          <StatBox
            title="Total Focus Duration"
            value={stats.totalFocusMinutes}
            format="time"
          />
        </div>
        <div className="flex flex-col gap-[8px]">
          <p className="text-[#8f92a9] text-[14px] tracking-[-0.84px]">
            Year Overview
          </p>
          <YearHeatmap byDate={stats.byDate} />
        </div>
      </div>

      {/* ── Focus Log ── */}
      <FocusLog sessions={stats.todaySessions} onEdit={onEditSession} onDelete={onDeleteSession} />

      {/* ── Account ── */}
      <AccountSection email={userEmail} syncStatus={syncStatus} onSignedIn={onSignedIn} />
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
