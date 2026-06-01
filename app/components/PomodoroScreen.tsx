"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AnimatedTimer from "./AnimatedTimer";
import { StatsPanelDragZone, StatsPanelScrollable } from "./StatsPanel";
import SettingsPanel from "./SettingsPanel";
import TimerControls from "./TimerControls";
import Sidebar from "./Sidebar";
import { tapHaptic } from "./haptics";
import { useGyroscope } from "./useGyroscope";
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
import { useWeather } from "./useWeather";

export interface PomodoroScreenProps {
  mode: PomodoroMode;
  state: PomodoroState;
  remaining?: number;
  stats?: PomodoroStats;
  weeklyGoalMinutes?: number;
  expanded?: boolean;
  fullscreen?: boolean;
  currentSessionStart?: number | null;
  currentSessionElapsed?: number;
  simNow?: number;
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

const FOCUS_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #b3b8eb 0%, #b3b8eb 100%)`;
const BREAK_BG = `${BOTTOM_BLOOM}, linear-gradient(180deg, #2d3a6b 0%, #2d3a6b 100%)`;

/* ── Design-time layout constants (based on 393×852 frame) ── */
const DESIGN_H = 852;
const SIDEBAR_W = 71;
const D_TOP_COLLAPSED = 660;
const D_TOP_EXPANDED = 160;
const D_TIMER_H_COLLAPSED = 665;
const D_TIMER_H_EXPANDED = 160;
const D_TIMER_PT_COLLAPSED = 10;
const D_TIMER_PT_EXPANDED = 8;
const D_TIMER_PB_COLLAPSED = 12;
const D_TIMER_PB_EXPANDED = 12;

/* ── Helpers ── */

function timerColor(
  mode: PomodoroMode,
  state: PomodoroState,
  expanded: boolean,
): string {
  if (expanded) return mode === "focus" ? "#494d7d" : "#f1f3fe";
  if (state === "paused") return "#a98461";
  if (mode === "focus") return "#494d7d";
  return "#f1f3fe";
}

function formatDateOrdinal(): { day: string; suffix: string; rest: string } {
  const d = new Date();
  const month = d.toLocaleDateString("en-US", { month: "long" });
  const day = d.getDate();
  const year = d.getFullYear();
  const suffixes = ["th", "st", "nd", "rd"];
  const v = day % 100;
  const suffix = suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
  return { day: `${month} ${day}`, suffix, rest: `, ${year}` };
}

export default function PomodoroScreen(props: PomodoroScreenProps) {
  const {
    mode,
    state,
    remaining = modeDuration(mode),
    stats = DEFAULT_STATS,
    weeklyGoalMinutes = DEFAULT_WEEKLY_GOAL_MINUTES,
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

  const isFocus = mode === "focus";
  const tColor = timerColor(mode, state, expanded);
  const totalDuration = modeDuration(mode, settings);
  const timerProgress = state === "default" ? 0 : 1 - remaining / totalDuration;
  const dateInfo = formatDateOrdinal();
  const weather = useWeather();
  const tilt = useGyroscope();

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
  const dragRange = topCollapsed - topExpanded;
  const expandThreshold = topCollapsed - dragRange * 0.08;
  const collapseThreshold = topExpanded + dragRange * 0.08;

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

      if (!expanded && finalTop < expandThreshold) {
        onOpenStats?.();
      } else if (expanded && finalTop > collapseThreshold) {
        onCloseStats?.();
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
  }, [expanded, topExpanded, topCollapsed, expandThreshold, collapseThreshold, onOpenStats, onCloseStats]);

  const resolvedTop = isDragging
    ? dragTop
    : expanded
      ? topExpanded
      : topCollapsed;
  const resolvedHeight = H - resolvedTop;

  const dragProgress =
    dragRange > 0
      ? Math.max(0, Math.min(1, (topCollapsed - resolvedTop) / dragRange))
      : expanded
        ? 1
        : 0;

  const handleSettingsClick = useCallback(() => {
    if (!expanded) {
      onOpenStats?.();
      setShowSettings(true);
    } else if (showSettings) {
      setShowSettings(false);
    } else {
      setShowSettings(true);
    }
  }, [expanded, showSettings, onOpenStats]);

  return (
    <div
      ref={containerRef}
      className={
        fullscreen
          ? "fixed inset-0 overflow-hidden"
          : "relative w-[393px] h-[852px] overflow-hidden rounded-[50px]"
      }
      style={{ backgroundColor: "#b3b8eb" }}
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

      {/* ── Decorative glass circles — parallax via gyroscope ── */}
      <div className="absolute pointer-events-none" style={{ left: -79, top: "calc(8.33% + 73px)", width: 584, height: 726 }}>
        {/* Large circle — upper area, slightly left of center */}
        <div
          className="absolute rounded-full"
          style={{
            width: 530,
            height: 530,
            left: 20,
            top: -10,
            border: "0.8px solid rgba(255, 255, 255, 0.2)",
            background: "radial-gradient(ellipse at 35% 30%, rgba(255,255,255,0.08) 0%, rgba(200,206,250,0.04) 50%, transparent 80%)",
            transform: `translate(${tilt.x * 15}px, ${tilt.y * 15}px)`,
            willChange: "transform",
          }}
        />
        {/* Medium circle — overlapping large, offset bottom-right */}
        <div
          className="absolute rounded-full"
          style={{
            width: 340,
            height: 340,
            left: 200,
            top: 260,
            border: "0.8px solid rgba(255, 255, 255, 0.18)",
            background: "radial-gradient(ellipse at 40% 35%, rgba(255,255,255,0.07) 0%, rgba(200,206,250,0.03) 50%, transparent 80%)",
            transform: `translate(${tilt.x * 10}px, ${tilt.y * 10}px)`,
            willChange: "transform",
          }}
        />
        {/* Small circle — bottom-right, partially visible */}
        <div
          className="absolute rounded-full"
          style={{
            width: 180,
            height: 180,
            left: 320,
            top: 440,
            border: "0.8px solid rgba(255, 255, 255, 0.14)",
            background: "radial-gradient(ellipse at 40% 35%, rgba(255,255,255,0.06) 0%, rgba(200,206,250,0.02) 50%, transparent 80%)",
            transform: `translate(${tilt.x * 6}px, ${tilt.y * 6}px)`,
            willChange: "transform",
          }}
        />
      </div>

      {/* ── Left sidebar ── */}
      <Sidebar
        onSettingsClick={handleSettingsClick}
        progress={timerProgress}
        fullscreen={fullscreen}
        tilt={tilt}
      />

      {/* ── Timer / header area ── */}
      <div
        className={`absolute top-0 px-[16px] flex flex-col pointer-events-none ${isDragging ? "" : "timer-area-transition"}`}
        style={{
          left: SIDEBAR_W,
          right: 0,
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
        {/* Date + weather pill — fades when expanded */}
        <div
          className={`flex items-center justify-between w-full rounded-[46px] pl-[8px] pr-[2px] py-[2px] ${isDragging ? "" : "fade-transition"}`}
          style={{
            opacity: 1 - dragProgress,
            background: isFocus ? "rgba(241, 243, 254, 0.4)" : "rgba(73, 77, 125, 0.4)",
          }}
        >
          <div
            className="text-[18px] tracking-[-0.54px] whitespace-nowrap flex items-center"
            style={{ color: isFocus ? "#5b6196" : "#c4cafa" }}
          >
            <span>{dateInfo.day}</span>
            <sup className="text-[11px] relative top-[-0.4em]">{dateInfo.suffix}</sup>
            <span>{dateInfo.rest}</span>
          </div>
          {weather && (
            <div
              className="flex items-center gap-[6px] rounded-[46px] px-[8px] py-[2px]"
              style={{ background: isFocus ? "rgba(241, 243, 254, 0.4)" : "rgba(73, 77, 125, 0.4)" }}
            >
              <span
                className="text-[18px] tracking-[-0.54px] whitespace-nowrap"
                style={{ color: isFocus ? "#5b6196" : "#c4cafa" }}
              >
                {weather.temp}°C
              </span>
              <span className="text-[18px]">{weather.icon}</span>
            </div>
          )}
        </div>

        {/* Timer — left-aligned */}
        <div
          className={`${isDragging ? "" : "text-transition"} leading-none mt-[4px]`}
          style={{
            color: tColor,
            fontSize: 64 - 20 * dragProgress,
            letterSpacing: `${-1.92 + 0.6 * dragProgress}px`,
          }}
        >
          <AnimatedTimer text={formatTimer(remaining)} />
        </div>
      </div>

      {/* ── Stats area ── */}
      <div
        ref={panelRef}
        className="absolute flex flex-col"
        style={{
          left: SIDEBAR_W + 6,
          right: 6,
          top: resolvedTop,
          bottom: 6,
          backgroundColor: "#f1f3fe",
          borderRadius: expanded ? "18px 18px 18px 18px" : "18px 18px 44px 18px",
          border: "0.5px solid #c4cafa",
          boxShadow: expanded
            ? "0px -8px 24px 0px rgba(73,77,125,0.12), inset 0px 4px 4px rgba(255,255,255,0.49)"
            : "0px 4px 4px rgba(0,0,0,0.25), inset 0px 4px 4px rgba(255,255,255,0.49)",
          transition: isDragging
            ? "none"
            : "top 500ms cubic-bezier(0.23,1,0.32,1), height 500ms cubic-bezier(0.23,1,0.32,1), border-radius 500ms cubic-bezier(0.23,1,0.32,1), box-shadow 500ms cubic-bezier(0.23,1,0.32,1)",
        }}
      >
        {/* Controls — anchored above panel, right-aligned */}
        <div
          className={`absolute right-0 left-0 ${isDragging ? "" : "fade-transition"} pointer-events-auto`}
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

        {/* Desktop-only stats toggle */}
        {!isMobile && (
          <div className="absolute right-[12px] flex items-center gap-[8px] pointer-events-auto" style={{ top: -55 }}>
            <button
              type="button"
              onClick={() => {
                tapHaptic();
                setShowSettings(false);
                if (expanded) onCloseStats?.();
                else onOpenStats?.();
              }}
              aria-label={expanded ? "Close stats" : "Open stats"}
              className="pressable-sm fade-transition flex items-center justify-center p-[7px] rounded-[12px]"
              style={{ background: "rgba(196, 202, 250, 0.32)" }}
            >
              <img
                src={expanded ? "/stats_active.svg" : "/stats_inactive.svg"}
                alt=""
                className="size-[31px]"
              />
            </button>
          </div>
        )}

        {/* Fixed top edge — content scrolls behind this */}
        <div
          className="absolute inset-x-0 z-20 pointer-events-none"
          style={{
            top: -1,
            height: 13,
            background: "#f1f3fe",
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            opacity: expanded ? 1 : 0,
          }}
        >
          <div
            className="absolute"
            style={{ bottom: -12, left: 0, width: 12, height: 12, background: "#f1f3fe" }}
          />
          <div
            className="absolute"
            style={{ bottom: -12, right: 0, width: 12, height: 12, background: "#f1f3fe" }}
          />
          <div
            className="absolute"
            style={{
              bottom: -12,
              left: 12,
              width: 12,
              height: 12,
              background: "radial-gradient(circle at 100% 100%, transparent 12px, #f1f3fe 12px)",
            }}
          />
          <div
            className="absolute"
            style={{
              bottom: -12,
              right: 12,
              width: 12,
              height: 12,
              background: "radial-gradient(circle at 0% 100%, transparent 12px, #f1f3fe 12px)",
            }}
          />
        </div>

        {/* Unified scrollable panel */}
        <div
          ref={scrollRef}
          className="flex-1 flex flex-col min-h-0"
          style={{
            borderRadius: "inherit",
            overflow: expanded ? "auto" : "hidden",
            touchAction: expanded ? "pan-y" : "none",
          }}
          {...(expanded ? { "data-scrollable": "" } : {})}
        >
          <div className="shrink-0 h-[12px]" />
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
                  settings={settings}
                />
              </div>
              <StatsPanelScrollable
                stats={stats}
                weeklyGoalMinutes={weeklyGoalMinutes}
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
