"use client";

import { useCallback, useRef, useState } from "react";
import AnimatedTimer from "./AnimatedTimer";
import ExpandedStatsContent from "./ExpandedStatsContent";
import StatsPanel from "./StatsPanel";
import TimerControls from "./TimerControls";
import {
  formatTimer,
  modeDuration,
  type PomodoroMode,
  type PomodoroState,
  type PomodoroStats,
} from "./pomodoro-types";

export interface PomodoroScreenProps {
  mode: PomodoroMode;
  state: PomodoroState;
  /** Remaining seconds. Defaults to the full duration of the current mode. */
  remaining?: number;
  stats?: PomodoroStats;
  /** When true the stats overlay is expanded. */
  expanded?: boolean;
  /** Start time (ms, simulated) of the currently in-progress focus session. */
  currentSessionStart?: number | null;
  /** Elapsed seconds of the currently in-progress focus session. */
  currentSessionElapsed?: number;
  /** Simulated "now" timestamp (ms) used to position the timeline playhead. */
  simNow?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSkip?: () => void;
  onOpenStats?: () => void;
  onCloseStats?: () => void;
}

const DEFAULT_STATS: PomodoroStats = {
  todayPomos: 5,
  todayFocusMinutes: 155,
  totalPomos: 214,
  totalFocusMinutes: 6755,
  todaySessions: [],
};

/* ── Background gradients ── */

// Collapsed: radial bloom anchored to bottom.
const BOTTOM_BLOOM =
  "radial-gradient(ellipse 142% 57% at 50% 99%, rgba(198,92,92,1) 0%, rgba(245,134,94,0.726) 29%, rgba(220,129,51,0.598) 42%, rgba(196,124,8,0.469) 54%, rgba(196,152,68,0.235) 77%, rgba(196,180,128,0) 100%)";

const FOCUS_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #e1e7f6 0%, #e1e7f6 100%)`;
const BREAK_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #31487b 0%, #31487b 100%)`;

// Expanded: radial bloom anchored to top.
const TOP_BLOOM =
  "radial-gradient(ellipse 220% 100% at 50% 0%, rgba(245,134,94,0.55) 0%, rgba(220,129,51,0.30) 30%, rgba(196,180,128,0) 70%)";

const FOCUS_TOP_BG = `${TOP_BLOOM}, linear-gradient(180deg, #e1e7f6 0%, #e6e1e0 100%)`;
const BREAK_TOP_BG = `${TOP_BLOOM}, linear-gradient(180deg, #31487b 0%, #e6e1e0 100%)`;

/* ── Layout constants ── */
const TOP_COLLAPSED = 544;
const TOP_EXPANDED = 140;
const TOP_MIDPOINT = (TOP_COLLAPSED + TOP_EXPANDED) / 2;

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
    expanded = false,
    currentSessionStart = null,
    currentSessionElapsed = 0,
    simNow,
    onPlay,
    onPause,
    onStop,
    onSkip,
    onOpenStats,
    onCloseStats,
  } = props;

  const header = headerColors(mode);
  const tColor = timerColor(mode, state, expanded);

  const isFocus = mode === "focus";

  /* ── Drag-to-expand/collapse ── */
  const [dragTop, setDragTop] = useState<number | null>(null);
  const isDragging = dragTop !== null;
  const dragRef = useRef<{
    startY: number;
    startTop: number;
    pointerId: number;
  } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only primary button / single touch
      if (e.button !== 0) return;
      const currentTop = expanded ? TOP_EXPANDED : TOP_COLLAPSED;
      dragRef.current = {
        startY: e.clientY,
        startTop: currentTop,
        pointerId: e.pointerId,
      };
      panelRef.current?.setPointerCapture(e.pointerId);
      setDragTop(currentTop);
    },
    [expanded],
  );

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dy = e.clientY - drag.startY;
    const newTop = Math.max(
      TOP_EXPANDED,
      Math.min(TOP_COLLAPSED, drag.startTop + dy),
    );
    setDragTop(newTop);
  }, []);

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      panelRef.current?.releasePointerCapture(drag.pointerId);
      dragRef.current = null;

      const finalTop = Math.max(
        TOP_EXPANDED,
        Math.min(TOP_COLLAPSED, drag.startTop + (e.clientY - drag.startY)),
      );
      setDragTop(null);

      // Snap based on midpoint
      if (finalTop < TOP_MIDPOINT) {
        // Snap to expanded
        if (!expanded) onOpenStats?.();
      } else {
        // Snap to collapsed
        if (expanded) onCloseStats?.();
      }
    },
    [expanded, onOpenStats, onCloseStats],
  );

  // Resolve the actual panel top — drag position overrides prop-driven position
  const resolvedTop = isDragging
    ? dragTop
    : expanded
      ? TOP_EXPANDED
      : TOP_COLLAPSED;
  const resolvedHeight = 852 - resolvedTop;

  return (
    <div className="relative w-[393px] h-[852px] overflow-hidden rounded-[50px] bg-[#e6e1e0]">
      {/* ── Background layers (cross-fade by mode × expanded) ── */}
      <div
        className="absolute inset-0 bg-crossfade"
        style={{ backgroundImage: FOCUS_BG, opacity: isFocus && !expanded ? 1 : 0 }}
      />
      <div
        className="absolute inset-0 bg-crossfade"
        style={{ backgroundImage: BREAK_BG, opacity: !isFocus && !expanded ? 1 : 0 }}
      />
      <div
        className="absolute inset-0 bg-crossfade"
        style={{ backgroundImage: FOCUS_TOP_BG, opacity: isFocus && expanded ? 1 : 0 }}
      />
      <div
        className="absolute inset-0 bg-crossfade"
        style={{ backgroundImage: BREAK_TOP_BG, opacity: !isFocus && expanded ? 1 : 0 }}
      />

      {/* ── Timer area ── */}
      <div
        className="absolute inset-x-0 top-0 timer-area-transition px-[20px] flex flex-col pointer-events-none"
        style={{
          height: expanded ? 140 : 589,
          paddingTop: expanded ? 60 : 120,
          paddingBottom: expanded ? 12 : 71,
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

          {/* Close button — visible only when expanded */}
          <button
            type="button"
            onClick={onCloseStats}
            aria-label="Close stats"
            className="pressable-sm fade-transition absolute right-0 bottom-0 flex items-center justify-center bg-[rgba(194,201,220,0.32)] p-[7px] rounded-[18px]"
            style={{
              opacity: expanded ? 1 : 0,
              pointerEvents: expanded ? "auto" : "none",
            }}
          >
            <img src="/stats_active.svg" alt="" className="size-[31px]" />
          </button>
        </div>

        {/* Controls — visible only when collapsed */}
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
            onPlay={onPlay}
            onPause={onPause}
            onStop={onStop}
            onSkip={onSkip}
            onOpenStats={onOpenStats}
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
          boxShadow: expanded
            ? "none"
            : "0px 0px 45px 0px rgba(133,114,114,0.25)",
          transition: isDragging
            ? "none"
            : "top 500ms var(--ease-out), height 500ms var(--ease-out), border-radius 500ms var(--ease-out), box-shadow 500ms var(--ease-out)",
          touchAction: "none",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-[7px] pb-[7px] cursor-grab active:cursor-grabbing shrink-0">
          <div className="w-[36px] h-[4px] rounded-full bg-[#c2c9dc]/50" />
        </div>

        {/* Scrollable inner when expanded */}
        <div
          className="flex-1 flex flex-col"
          style={{ overflowY: expanded ? "auto" : "hidden" }}
        >
          <StatsPanel
            stats={stats}
            currentSessionStart={currentSessionStart}
            currentSessionElapsed={currentSessionElapsed}
            simNow={simNow}
          />

          {/* Expanded-only content */}
          <div
            className="expanded-content-transition overflow-hidden"
            style={{
              opacity: expanded ? 1 : 0,
              maxHeight: expanded ? 9999 : 0,
            }}
          >
            <ExpandedStatsContent />
          </div>
        </div>
      </div>
    </div>
  );
}
