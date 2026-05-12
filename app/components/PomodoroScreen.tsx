"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnimatedTimer from "./AnimatedTimer";
import { StatsPanelDragZone, StatsPanelScrollable } from "./StatsPanel";
import TimerControls from "./TimerControls";
import {
  DEFAULT_WEEKLY_GOAL_MINUTES,
  formatTimer,
  modeDuration,
  type PomodoroMode,
  type PomodoroState,
  type PomodoroStats,
} from "./pomodoro-types";
import type { SyncStatus } from "./useSync";

export interface PomodoroScreenProps {
  mode: PomodoroMode;
  state: PomodoroState;
  /** Remaining seconds. Defaults to the full duration of the current mode. */
  remaining?: number;
  stats?: PomodoroStats;
  /** Weekly focus minutes goal. Defaults to 1800 (30h). */
  weeklyGoalMinutes?: number;
  /** Carryover from prior week — positive = deficit, negative = surplus. */
  carryoverMinutes?: number;
  /** When true the stats overlay is expanded. */
  expanded?: boolean;
  /** Fill the viewport instead of using fixed 393×852 dimensions. */
  fullscreen?: boolean;
  /** Start time (ms, simulated) of the currently in-progress focus session. */
  currentSessionStart?: number | null;
  /** Elapsed seconds of the currently in-progress focus session. */
  currentSessionElapsed?: number;
  /** Simulated "now" timestamp (ms) used to position the timeline playhead. */
  simNow?: number;
  /** Authenticated user's email, or null when signed out. */
  userEmail?: string | null;
  syncStatus?: SyncStatus;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSkip?: () => void;
  onOpenStats?: () => void;
  onCloseStats?: () => void;
  onSignedIn?: () => void;
}

const DEFAULT_STATS: PomodoroStats = {
  todayPomos: 5,
  todayFocusMinutes: 155,
  totalPomos: 214,
  totalFocusMinutes: 6755,
  todaySessions: [],
  weeklyFocusMinutes: [60, 120, 90, 180, 75, 240, 155],
};

/* ── Background gradients ── */

// Collapsed: radial bloom anchored at bottom of the timer area (~584px),
// sized to match the Figma radialGradient matrix transform exactly.
const BOTTOM_BLOOM =
  "radial-gradient(663px 394px at 200px 584px, rgba(198,92,92,1) 0%, rgba(245,134,94,0.726) 29.3%, rgba(220,129,51,0.598) 41.8%, rgba(196,124,8,0.469) 54.3%, rgba(196,152,68,0.235) 77.2%, rgba(196,180,128,0) 100%)";

// Only 2 layers needed — one per mode. The stats panel sliding up/down
// naturally reveals/hides the bloom. No collapsed vs expanded crossfade.
const FOCUS_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #e1e7f6 0%, #e1e7f6 100%)`;
const BREAK_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #31487b 0%, #31487b 100%)`;

/* ── Design-time layout constants (based on 393×852 frame) ── */
const DESIGN_H = 852;
const D_TOP_COLLAPSED = 544;
const D_TOP_EXPANDED = 160;
const D_TIMER_H_COLLAPSED = 589;
const D_TIMER_H_EXPANDED = 160;
const D_TIMER_PT_COLLAPSED = 120;
const D_TIMER_PT_EXPANDED = 16;
const D_TIMER_PB_COLLAPSED = 65;
const D_TIMER_PB_EXPANDED = 12;

/* ── Helpers ── */

function timerColor(
  mode: PomodoroMode,
  state: PomodoroState,
  expanded: boolean,
): string {
  if (expanded) return mode === "focus" ? "#545b7f" : "#e6e1e0";
  if (state === "paused") return "#a98461";
  if (mode === "focus") return "#545b7f";
  return "#e6e1e0";
}

function headerColors(mode: PomodoroMode) {
  if (mode === "focus") {
    return {
      active: "#545b7f",
      inactive: "rgba(103,114,209,0.28)",
      activeLabel: "Focusing",
      inactiveLabel: "Short Break",
    };
  }
  return {
    active: "#e6e1e0",
    inactive: "#7b7fab",
    activeLabel: "Short Break",
    inactiveLabel: "Focus",
  };
}

export default function PomodoroScreen(props: PomodoroScreenProps) {
  const {
    mode,
    state,
    remaining = modeDuration(mode),
    stats = DEFAULT_STATS,
    weeklyGoalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES,
    carryoverMinutes = 0,
    expanded = false,
    fullscreen = false,
    currentSessionStart = null,
    currentSessionElapsed = 0,
    simNow,
    userEmail = null,
    syncStatus = "idle",
    onPlay,
    onPause,
    onStop,
    onSkip,
    onOpenStats,
    onCloseStats,
    onSignedIn,
  } = props;

  const header = headerColors(mode);
  const tColor = timerColor(mode, state, expanded);
  const isFocus = mode === "focus";

  /* ── Prevent iOS rubber-band overscroll revealing white gap ── */
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-scrollable]")) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", handler, { passive: false });
    return () => document.removeEventListener("touchmove", handler);
  }, [fullscreen]);

  /* ── Responsive scaling ── */
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerH, setContainerH] = useState(DESIGN_H);

  useEffect(() => {
    if (!fullscreen) return;
    const el = containerRef.current;
    if (!el) return;
    setContainerH(el.clientHeight);
    const observer = new ResizeObserver(([entry]) => {
      setContainerH(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fullscreen]);

  const H = fullscreen ? containerH : DESIGN_H;
  const s = H / DESIGN_H;

  const topCollapsed = Math.round(D_TOP_COLLAPSED * s);
  const topExpanded = Math.round(D_TOP_EXPANDED * s);
  const topMidpoint = (topCollapsed + topExpanded) / 2;

  /* ── Drag-to-expand/collapse ── */
  const [dragTop, setDragTop] = useState<number | null>(null);
  const isDragging = dragTop !== null;
  const dragRef = useRef<{
    startY: number;
    startTop: number;
    pointerId: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const dragZoneRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const currentTop = expanded ? topExpanded : topCollapsed;
      dragRef.current = {
        startY: e.clientY,
        startTop: currentTop,
        pointerId: e.pointerId,
      };
      dragZoneRef.current?.setPointerCapture(e.pointerId);
      setDragTop(currentTop);
    },
    [expanded, topExpanded, topCollapsed],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dy = e.clientY - drag.startY;
      const newTop = Math.max(
        topExpanded,
        Math.min(topCollapsed, drag.startTop + dy),
      );
      setDragTop(newTop);
    },
    [topExpanded, topCollapsed],
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      dragZoneRef.current?.releasePointerCapture(drag.pointerId);
      dragRef.current = null;

      const finalTop = Math.max(
        topExpanded,
        Math.min(topCollapsed, drag.startTop + (e.clientY - drag.startY)),
      );
      setDragTop(null);

      if (finalTop < topMidpoint) {
        if (!expanded) onOpenStats?.();
      } else {
        if (expanded) onCloseStats?.();
      }
    },
    [expanded, topExpanded, topCollapsed, topMidpoint, onOpenStats, onCloseStats],
  );

  const resolvedTop = isDragging
    ? dragTop
    : expanded
      ? topExpanded
      : topCollapsed;
  const resolvedHeight = H - resolvedTop;

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? "relative w-full h-dvh overflow-hidden bg-[#e6e1e0]"
          : "relative w-[393px] h-[852px] overflow-hidden rounded-[50px] bg-[#e6e1e0]"
      }
    >
      {/* ── Background layers (cross-fade by mode only) ── */}
      <div
        className="absolute inset-0 bg-crossfade"
        style={{ backgroundImage: FOCUS_BG, opacity: isFocus ? 1 : 0 }}
      />
      <div
        className="absolute inset-0 bg-crossfade"
        style={{ backgroundImage: BREAK_BG, opacity: isFocus ? 0 : 1 }}
      />

      {/* ── Timer area ── */}
      <div
        className="absolute inset-x-0 top-0 timer-area-transition px-[20px] flex flex-col pointer-events-none"
        style={{
          height: expanded
            ? Math.round(D_TIMER_H_EXPANDED * s)
            : Math.round(D_TIMER_H_COLLAPSED * s),
          paddingTop: fullscreen
            ? `calc(${expanded ? Math.round(D_TIMER_PT_EXPANDED * s) : Math.round(D_TIMER_PT_COLLAPSED * s)}px + env(safe-area-inset-top, 0px))`
            : expanded
              ? Math.round(D_TIMER_PT_EXPANDED * s)
              : Math.round(D_TIMER_PT_COLLAPSED * s),
          paddingBottom: expanded
            ? Math.round(D_TIMER_PB_EXPANDED * s)
            : Math.round(D_TIMER_PB_COLLAPSED * s),
        }}
      >
        {/* Header + timer text */}
        <div className="flex flex-col items-center w-full drop-shadow-[0px_4px_22.8px_rgba(255,255,255,0.25)] relative">
          <div
            className="flex items-center justify-center w-full"
            style={{ gap: expanded ? 5 : 6 }}
          >
            <p
              className="text-transition leading-none whitespace-nowrap [text-shadow:0px_0px_14.9px_rgba(194,201,220,0.67)]"
              style={{
                color: header.active,
                fontSize: expanded ? 16 : 20,
                letterSpacing: expanded ? "-0.96px" : "-1.2px",
              }}
            >
              {header.activeLabel}
            </p>
            <img
              src="/arrow.svg"
              alt=""
              className="text-transition"
              style={{
                height: expanded ? 12 : 16,
                width: expanded ? 12 : 15,
              }}
            />
            <p
              className="text-transition leading-none whitespace-nowrap"
              style={{
                color: header.inactive,
                fontSize: expanded ? 16 : 20,
                letterSpacing: expanded ? "-0.96px" : "-1.2px",
              }}
            >
              {header.inactiveLabel}
            </p>
          </div>

          <div
            className="text-transition leading-none text-center w-full"
            style={{
              color: tColor,
              fontSize: expanded ? 44 : 96,
              letterSpacing: expanded ? "-1.32px" : "-2.88px",
              marginTop: expanded ? 6 : 16,
            }}
          >
            <AnimatedTimer text={formatTimer(remaining)} />
          </div>

        </div>

        {/* Controls — play/pause/stop fade out when expanded */}
        <div
          className="fade-transition mt-auto"
          style={{
            opacity: expanded ? 0 : 1,
            pointerEvents: expanded ? "none" : "auto",
          }}
        >
          <TimerControls
            mode={mode}
            state={state}
            expanded={expanded}
            onPlay={onPlay}
            onPause={onPause}
            onStop={onStop}
            onSkip={onSkip}
            onOpenStats={onOpenStats}
            onCloseStats={onCloseStats}
          />
        </div>
      </div>

      {/* ── Stats area ── */}
      <div
        ref={panelRef}
        className="absolute inset-x-0 flex flex-col bg-[#e6e1e0]"
        style={{
          top: resolvedTop,
          height: resolvedHeight,
          borderTopLeftRadius: 36,
          borderTopRightRadius: 36,
          border: "0.5px solid rgba(133,114,114,0.15)",
          borderBottom: "none",
          boxShadow: expanded
            ? "0px -8px 24px 0px rgba(133,114,114,0.12)"
            : "0px 0px 45px 0px rgba(133,114,114,0.25)",
          transition: isDragging
            ? "none"
            : "top 500ms var(--ease-out), height 500ms var(--ease-out), border-radius 500ms var(--ease-out), box-shadow 500ms var(--ease-out)",
        }}
      >
        {/* Stats toggle — anchored to panel so it moves with drag */}
        <button
          type="button"
          onClick={expanded ? onCloseStats : onOpenStats}
          aria-label={expanded ? "Close stats" : "Open stats"}
          className="pressable-sm fade-transition absolute right-[20px] flex items-center justify-center bg-[rgba(194,201,220,0.32)] p-[7px] rounded-[18px] pointer-events-auto"
          style={{ top: -65 }}
        >
          <img
            src={expanded ? "/stats_active.svg" : "/stats_inactive.svg"}
            alt=""
            className="size-[31px]"
          />
        </button>

        {/* Drag zone: handle + timeline + daily stats — dragging anywhere here resizes the panel */}
        <div
          ref={dragZoneRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="shrink-0"
          style={{ touchAction: "none", cursor: expanded ? "grab" : "grab" }}
        >
          {/* Drag handle bar */}
          <div className="flex justify-center pt-[7px] pb-[7px] cursor-grab active:cursor-grabbing">
            <div className="w-[36px] h-[4px] rounded-full bg-[#c2c9dc]/50" />
          </div>
          <StatsPanelDragZone
            stats={stats}
            currentSessionStart={currentSessionStart}
            currentSessionElapsed={currentSessionElapsed}
            simNow={simNow}
          />
        </div>

        {/* Scrollable rest of the stats */}
        <div
          className="flex-1 flex flex-col"
          data-scrollable={expanded ? "" : undefined}
          style={{
            overflowY: expanded ? "auto" : "hidden",
            touchAction: expanded ? "pan-y" : "none",
          }}
        >
          <StatsPanelScrollable
            stats={stats}
            weeklyGoalMinutes={weeklyGoalMinutes}
            carryoverMinutes={carryoverMinutes}
            userEmail={userEmail}
            syncStatus={syncStatus}
            onSignedIn={onSignedIn}
          />
        </div>
      </div>
    </div>
  );
}
