"use client";

import { useEffect, useRef } from "react";
import StatBox from "./StatBox";
import {
  FOCUS_DURATION_SECONDS,
  type PomodoroStats,
  type SessionEntry,
} from "./pomodoro-types";

export interface StatsPanelProps {
  stats: PomodoroStats;
  currentSessionStart?: number | null;
  currentSessionElapsed?: number;
  simNow?: number;
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
  currentSessionStart: number | null;
  currentSessionElapsed: number;
  now: number;
}

function MiniSessionTimeline(props: MiniSessionTimelineProps) {
  const { sessions, currentSessionStart, currentSessionElapsed, now } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  const nowHour = hoursOfDay(now);

  useEffect(() => {
    if (hasScrolledRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const trackWidth = container.scrollWidth;
    const targetLeftHour = Math.max(0, Math.min(16, nowHour - 6));
    container.scrollLeft = (targetLeftHour / 24) * trackWidth;
    hasScrolledRef.current = true;
  }, [nowHour]);

  const inProgressStartHour =
    currentSessionStart !== null ? hoursOfDay(currentSessionStart) : 0;

  return (
    <div className="bg-[#cec1bf] h-[100px] rounded-[18px] overflow-hidden w-full relative">
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide h-full"
      >
        <div className="relative h-full" style={{ width: "300%" }}>
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
                  width: `${(FOCUS_DURATION_SECONDS / SECONDS_PER_DAY) * 100}%`,
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

export default function StatsPanel(props: StatsPanelProps) {
  const {
    stats,
    currentSessionStart = null,
    currentSessionElapsed = 0,
    simNow,
  } = props;
  return (
    <div className="pb-[14px] px-[18px] flex flex-col gap-[22px]">
      <div className="w-full max-w-[356px] mx-auto">
        <MiniSessionTimeline
          sessions={stats.todaySessions}
          currentSessionStart={currentSessionStart}
          currentSessionElapsed={currentSessionElapsed}
          now={simNow ?? Date.now()}
        />
      </div>
      <div className="grid grid-cols-2 gap-[10px] w-full max-w-[356px] mx-auto">
        <StatBox title="Today’s Pomos" value={stats.todayPomos} />
        <StatBox
          title="Today’s Focus Duration"
          value={stats.todayFocusMinutes}
          format="time"
        />
        <StatBox title="Total Pomos" value={stats.totalPomos} />
        <StatBox
          title="Total Focus Duration"
          value={stats.totalFocusMinutes}
          format="time"
        />
      </div>
    </div>
  );
}
