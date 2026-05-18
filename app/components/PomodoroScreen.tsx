"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnimatedTimer from "./AnimatedTimer";
import { StatsPanelDragZone, StatsPanelScrollable } from "./StatsPanel";
import SettingsPanel from "./SettingsPanel";
import TimerControls from "./TimerControls";
import { tapHaptic } from "./haptics";
import {
  DEFAULT_SETTINGS,
  DEFAULT_WEEKLY_GOAL_MINUTES,
  formatTimer,
  modeDuration,
  type PomodoroMode,
  type PomodoroState,
  type PomodoroStats,
  type SessionEntry,
} from "./pomodoro-types";
import type { PomodoroSettings } from "./pomodoro-types";
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
  settings?: PomodoroSettings;
  onSettingsChange?: (s: PomodoroSettings) => void;
  onEditSession?: (original: SessionEntry, updated: SessionEntry) => void;
  onDeleteSession?: (session: SessionEntry) => void;
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
  byDate: {},
};

/* ── Background gradients ── */

const BOTTOM_BLOOM =
  "radial-gradient(663px 394px at 200px 584px, rgba(198,92,92,1) 0%, rgba(245,134,94,0.726) 29.3%, rgba(220,129,51,0.598) 41.8%, rgba(196,124,8,0.469) 54.3%, rgba(196,152,68,0.235) 77.2%, rgba(196,180,128,0) 100%)";

const FOCUS_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #e1e7f6 0%, #e1e7f6 100%)`;
const BREAK_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #31487b 0%, #31487b 100%)`;

/* ── Design-time layout constants (based on 393×852 frame) ── */
const DESIGN_H = 852;
const D_TOP_COLLAPSED = 620;
const D_TOP_EXPANDED = 160;
const D_TIMER_H_COLLAPSED = 625;
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
      inactiveLabel: "Break",
    };
  }
  const label = mode === "longBreak" ? "Long Break" : "Short Break";
  return {
    active: "#e6e1e0",
    inactive: "#7b7fab",
    activeLabel: label,
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
    settings = DEFAULT_SETTINGS,
    onSettingsChange,
    onEditSession,
    onDeleteSession,
    onOpenStats,
    onCloseStats,
    onSignedIn,
  } = props;

  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!expanded) setShowSettings(false);
  }, [expanded]);

  const header = headerColors(mode);
  const tColor = timerColor(mode, state, expanded);
  const isFocus = mode === "focus";

  /* ── Prevent iOS rubber-band overscroll revealing white gap ── */
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-scrollable], [data-scrollable-x]")) return;
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

  /* ── Drag-to-expand/collapse (overscroll-to-dismiss) ── */
  const [dragTop, setDragTop] = useState<number | null>(null);
  const isDragging = dragTop !== null;
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const DIRECTION_THRESHOLD = 8;

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let startTop = 0;
    let direction: "vertical" | "horizontal" | null = null;
    let active = false;
    let dragging = false;

    const onTouchStart = (e: TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-scrollable-x]")) {
        active = false;
        return;
      }
      const t = e.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      startTop = expanded ? topExpanded : topCollapsed;
      direction = null;
      active = true;
      dragging = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!active) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - startX);
      const dy = Math.abs(t.clientY - startY);
      const rawDy = t.clientY - startY;

      if (!direction) {
        if (dx < DIRECTION_THRESHOLD && dy < DIRECTION_THRESHOLD) return;
        direction = dx > dy ? "horizontal" : "vertical";
      }

      if (direction === "horizontal") return;

      if (!dragging) {
        const scrollEl = scrollRef.current;
        const atTop = !scrollEl || scrollEl.scrollTop <= 0;
        const pullingDown = rawDy > 0;

        if (expanded && !(atTop && pullingDown)) return;

        dragging = true;
        setDragTop(startTop);
      }

      e.preventDefault();
      const newTop = Math.max(
        topExpanded,
        Math.min(topCollapsed, startTop + (t.clientY - startY)),
      );
      setDragTop(newTop);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!active) return;
      active = false;

      if (!dragging) {
        direction = null;
        return;
      }

      const t = e.changedTouches[0];
      const finalTop = Math.max(
        topExpanded,
        Math.min(topCollapsed, startTop + (t.clientY - startY)),
      );
      setDragTop(null);
      direction = null;
      dragging = false;

      if (finalTop < topMidpoint) {
        if (!expanded) onOpenStats?.();
      } else {
        if (expanded) onCloseStats?.();
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [expanded, topExpanded, topCollapsed, topMidpoint, onOpenStats, onCloseStats]);

  const resolvedTop = isDragging
    ? dragTop
    : expanded
      ? topExpanded
      : topCollapsed;
  const resolvedHeight = H - resolvedTop;

  const dragRange = topCollapsed - topExpanded;
  const dragProgress =
    dragRange > 0
      ? Math.max(0, Math.min(1, (topCollapsed - resolvedTop) / dragRange))
      : expanded
        ? 1
        : 0;

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? "fixed inset-0 overflow-hidden"
          : "relative w-[393px] h-[852px] overflow-hidden rounded-[50px]"
      }
      style={{ backgroundColor: "#e6e1e0" }}
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
        className={`absolute inset-x-0 top-0 px-[20px] flex flex-col pointer-events-none ${isDragging ? "" : "timer-area-transition"}`}
        style={{
          height: Math.round(
            (D_TIMER_H_COLLAPSED + (D_TIMER_H_EXPANDED - D_TIMER_H_COLLAPSED) * dragProgress) * s,
          ),
          paddingTop: fullscreen
            ? `calc(${Math.round(
                (D_TIMER_PT_COLLAPSED + (D_TIMER_PT_EXPANDED - D_TIMER_PT_COLLAPSED) * dragProgress) * s,
              )}px + env(safe-area-inset-top, 0px))`
            : Math.round(
                (D_TIMER_PT_COLLAPSED + (D_TIMER_PT_EXPANDED - D_TIMER_PT_COLLAPSED) * dragProgress) * s,
              ),
          paddingBottom: Math.round(
            (D_TIMER_PB_COLLAPSED + (D_TIMER_PB_EXPANDED - D_TIMER_PB_COLLAPSED) * dragProgress) * s,
          ),
        }}
      >
        {/* Header + timer text */}
        <div className="flex flex-col items-center w-full drop-shadow-[0px_4px_22.8px_rgba(255,255,255,0.25)] relative">
          <div
            className="flex items-center justify-center w-full"
            style={{ gap: 6 - dragProgress }}
          >
            <p
              className={`${isDragging ? "" : "text-transition"} leading-none whitespace-nowrap [text-shadow:0px_0px_14.9px_rgba(194,201,220,0.67)]`}
              style={{
                color: header.active,
                fontSize: 20 - 4 * dragProgress,
                letterSpacing: `${-1.2 + 0.24 * dragProgress}px`,
              }}
            >
              {header.activeLabel}
            </p>
            <img
              src="/arrow.svg"
              alt=""
              className={isDragging ? "" : "text-transition"}
              style={{
                height: 16 - 4 * dragProgress,
                width: 15 - 3 * dragProgress,
              }}
            />
            <p
              className={`${isDragging ? "" : "text-transition"} leading-none whitespace-nowrap`}
              style={{
                color: header.inactive,
                fontSize: 20 - 4 * dragProgress,
                letterSpacing: `${-1.2 + 0.24 * dragProgress}px`,
              }}
            >
              {header.inactiveLabel}
            </p>
          </div>

          <div
            className={`${isDragging ? "" : "text-transition"} leading-none text-center w-full`}
            style={{
              color: tColor,
              fontSize: 96 - 52 * dragProgress,
              letterSpacing: `${-2.88 + 1.56 * dragProgress}px`,
              marginTop: 16 - 10 * dragProgress,
            }}
          >
            <AnimatedTimer text={formatTimer(remaining)} />
          </div>

        </div>

      </div>

      {/* ── Stats area ── */}
      <div
        ref={panelRef}
        className="absolute inset-x-0 flex flex-col"
        style={{
          top: resolvedTop,
          bottom: 0,
          backgroundColor: "#e6e1e0",
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
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
        {/* Controls — anchored to panel, fade with drag */}
        <div
          className={`absolute left-[20px] right-[20px] ${isDragging ? "" : "fade-transition"} pointer-events-auto`}
          style={{
            top: -65,
            opacity: 1 - dragProgress,
            pointerEvents: dragProgress > 0.5 ? "none" : "auto",
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

        {/* Top-right button — stats toggle on desktop, settings on mobile */}
        {isMobile ? (
          <button
            type="button"
            onClick={() => {
              tapHaptic();
              if (!expanded) {
                onOpenStats?.();
                setShowSettings(true);
              } else if (showSettings) {
                setShowSettings(false);
              } else {
                setShowSettings(true);
              }
            }}
            aria-label="Settings"
            className="pressable-sm fade-transition absolute right-[20px] flex items-center justify-center pointer-events-auto"
            style={{ top: -51 }}
          >
            <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="#545b7f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        ) : (
          <div className="absolute right-[20px] flex items-center gap-[8px] pointer-events-auto" style={{ top: -65 }}>
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                if (!expanded) onOpenStats?.();
                setShowSettings((v) => !v);
              }}
              aria-label="Settings"
              className="pressable-sm fade-transition flex items-center justify-center bg-[rgba(194,201,220,0.32)] p-[7px] rounded-[12px]"
            >
              <svg width="31" height="31" viewBox="0 0 24 24" fill="none" stroke="#545b7f" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                setShowSettings(false);
                if (expanded) onCloseStats?.();
                else onOpenStats?.();
              }}
              aria-label={expanded ? "Close stats" : "Open stats"}
              className="pressable-sm fade-transition flex items-center justify-center bg-[rgba(194,201,220,0.32)] p-[7px] rounded-[12px]"
            >
              <img
                src={expanded ? "/stats_active.svg" : "/stats_inactive.svg"}
                alt=""
                className="size-[31px]"
              />
            </button>
          </div>
        )}

        {/* Unified scrollable panel — overscroll at top triggers collapse */}
        <div
          ref={scrollRef}
          className="flex-1 flex flex-col min-h-0"
          data-scrollable={expanded ? "" : undefined}
          style={{
            overflowY: expanded ? "auto" : "hidden",
            touchAction: expanded ? "pan-y" : "none",
          }}
        >
          {/* Drag handle bar */}
          <div className="flex justify-center pt-[7px] pb-[7px] shrink-0 cursor-grab active:cursor-grabbing">
            <div className="w-[36px] h-[4px] rounded-full bg-[#c2c9dc]/50" />
          </div>

          {showSettings ? (
            <SettingsPanel
              settings={settings}
              onChange={(s) => onSettingsChange?.(s)}
              userEmail={userEmail}
              syncStatus={syncStatus}
              onSignedIn={onSignedIn}
            />
          ) : (
            <>
              <div className="shrink-0">
                <StatsPanelDragZone
                  stats={stats}
                  currentSessionStart={currentSessionStart}
                  currentSessionElapsed={currentSessionElapsed}
                  simNow={simNow}
                  focusDurationMinutes={settings.focusDurationMinutes}
                  weeklyGoalMinutes={weeklyGoalMinutes}
                  carryoverMinutes={carryoverMinutes}
                  settings={settings}
                />
              </div>
              <StatsPanelScrollable
                stats={stats}
                weeklyGoalMinutes={weeklyGoalMinutes}
                carryoverMinutes={carryoverMinutes}
                userEmail={userEmail}
                syncStatus={syncStatus}
                onSignedIn={onSignedIn}
                settings={settings}
                onEditSession={onEditSession}
                onDeleteSession={onDeleteSession}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
