"use client";

import { useState } from "react";

const MOCK_SESSIONS = [
  { startTime: Date.now() - 3600000 * 3, durationSeconds: 1500 },
  { startTime: Date.now() - 3600000 * 5, durationSeconds: 1500 },
  { startTime: Date.now() - 3600000 * 7, durationSeconds: 900 },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKLY_DATA = [60, 120, 90, 180, 25, 0, 0];

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

function StatCard({ title, value, large }: { title: string; value: string; large?: boolean }) {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-[18px] p-[20px] flex flex-col gap-[8px]">
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">{title}</p>
      <p className={`text-[var(--color-text-primary)] tracking-[-1px] leading-none ${large ? "text-[48px]" : "text-[32px]"}`}>
        {value}
      </p>
    </div>
  );
}

function Timer() {
  const [mode] = useState<"focus" | "break">("focus");
  const [remaining] = useState(25 * 60);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <div className="bg-[var(--color-bg-card)] rounded-[var(--radius-xl)] p-[40px] flex flex-col items-center justify-center gap-[16px]">
      <div className="flex items-center gap-[8px]">
        <span className="text-[var(--color-text-primary)] text-[var(--text-headline)] tracking-[var(--tracking-tight)]">
          {mode === "focus" ? "Focusing" : "Break"}
        </span>
        <span className="text-[var(--color-text-secondary)] text-[var(--text-headline)]">→</span>
        <span className="text-[var(--color-text-secondary)]/40 text-[var(--text-headline)] tracking-[var(--tracking-tight)]">
          {mode === "focus" ? "Short Break" : "Focus"}
        </span>
      </div>
      <p className="text-[var(--color-text-primary)] text-[96px] tracking-[-3px] leading-none">
        {m}:{s.toString().padStart(2, "0")}
      </p>
      <div className="flex gap-[12px] mt-[8px]">
        <button className="bg-[var(--color-bar-fill)] text-[var(--color-text-inverse)] px-[32px] py-[12px] rounded-[16px] text-[16px] tracking-[var(--tracking-tight)]">
          Start
        </button>
        <button className="bg-[var(--color-bg-page)] text-[var(--color-text-primary)] px-[32px] py-[12px] rounded-full text-[16px] tracking-[var(--tracking-tight)] border border-[#545b7f]/20">
          Skip
        </button>
      </div>
    </div>
  );
}

function TodaysPomos() {
  const completed = 2;
  const remaining = 5;
  return (
    <div className="bg-[var(--color-bg-card)] rounded-[18px] p-[20px] flex flex-col gap-[8px]">
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">Today&apos;s Pomos</p>
      <div className="flex flex-wrap gap-[5px]">
        {Array.from({ length: completed }).map((_, i) => (
          <div key={`c-${i}`} className="size-[18px] rounded-[4px] bg-[var(--color-bar-fill)]" />
        ))}
        {Array.from({ length: remaining }).map((_, i) => (
          <div
            key={`r-${i}`}
            className="size-[18px] rounded-[4px]"
            style={{ border: "1.5px dashed #a98461", background: "transparent" }}
          />
        ))}
      </div>
    </div>
  );
}

function WeeklyChart() {
  const maxH = 8;
  return (
    <div className="bg-[var(--color-bg-card)] rounded-[18px] p-[20px] flex flex-col gap-[12px]">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">Daily Average</p>
          <p className="text-[var(--color-text-primary)] text-[28px] tracking-[-1px] leading-none mt-[4px]">1h 8m</p>
        </div>
        <div className="flex items-center gap-[4px]">
          <span className="text-[var(--color-text-secondary)] text-[var(--text-body)]">‹</span>
          <span className="text-[var(--color-text-primary)] text-[var(--text-footnote)] tracking-[var(--tracking-tight)]">This week</span>
          <span className="text-[var(--color-text-secondary)]/30 text-[var(--text-body)]">›</span>
        </div>
      </div>
      <div className="flex items-end gap-[8px] h-[120px]">
        {DAY_LABELS.map((label, i) => {
          const hours = (WEEKLY_DATA[i] ?? 0) / 60;
          const pct = Math.min(1, hours / maxH) * 100;
          const targetPct = Math.min(1, 3 / maxH) * 100;
          const isToday = i === new Date().getDay();
          const isFuture = i > new Date().getDay();
          return (
            <div key={label} className="flex-1 flex flex-col items-center gap-[4px]">
              <div className="w-full relative h-[100px]">
                {!isFuture && pct > 0 && (
                  <div
                    className="absolute inset-x-0 bottom-0 bg-[var(--color-bar-fill)] rounded-[3px]"
                    style={{ height: `${pct}%` }}
                  />
                )}
                {(isToday || isFuture) && (
                  <div
                    className="absolute inset-x-0 bottom-0 rounded-[3px]"
                    style={{
                      height: `${targetPct}%`,
                      border: "1.5px dashed #a98461",
                      background: "transparent",
                    }}
                  />
                )}
              </div>
              <span className="text-[var(--color-text-secondary)] text-[var(--text-caption)] tracking-[var(--tracking-tight)]">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FocusLog() {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-[18px] p-[20px] flex flex-col gap-[8px]">
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">Focus Log</p>
      <div className="flex flex-col">
        {MOCK_SESSIONS.map((s, i) => {
          const endTime = s.startTime + s.durationSeconds * 1000;
          const isCompleted = s.durationSeconds >= 1500;
          return (
            <div key={i} className="flex items-stretch">
              <div className="flex flex-col items-center w-[24px] shrink-0 relative">
                <div
                  className="size-[8px] rounded-full mt-[6px] shrink-0 z-10"
                  style={{ backgroundColor: isCompleted ? "#545b7f" : "#a98461" }}
                />
                {i < MOCK_SESSIONS.length - 1 && (
                  <div className="w-[1.5px] bg-[var(--color-border-divider)]/60 absolute top-[10px] bottom-[-6px]" />
                )}
              </div>
              <div className="flex items-center justify-between flex-1 min-w-0 pb-[14px] pl-[8px]">
                <span className="text-[var(--color-text-primary)] text-[var(--text-footnote)] tracking-[var(--tracking-tight)]">
                  {formatTime12(s.startTime)} – {formatTime12(endTime)}
                </span>
                <span className="text-[var(--color-text-secondary)] text-[var(--text-footnote)] tracking-[var(--tracking-tight)]">
                  {formatDuration(s.durationSeconds)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearHeatmap() {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-[18px] p-[20px] flex flex-col gap-[8px]">
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">Year Overview</p>
      <div className="flex flex-col gap-[3px]">
        {Array.from({ length: 7 }).map((_, r) => (
          <div key={r} className="flex gap-[3px]">
            {Array.from({ length: 52 }).map((_, c) => {
              const rand = Math.random();
              const color =
                rand > 0.9 ? "#545b7f" : rand > 0.8 ? "#6b6f94" : rand > 0.6 ? "#8f92a9" : rand > 0.4 ? "#b8b0c4" : "#e6e1e0";
              return <div key={c} className="size-[6px] rounded-[1px]" style={{ backgroundColor: color }} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsPanel() {
  return (
    <div className="bg-[var(--color-bg-card)] rounded-[18px] p-[20px] flex flex-col gap-[16px]">
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">Settings</p>
      {[
        { label: "Daily study goal", value: "3 hrs" },
        { label: "Focus duration", value: "25 min" },
        { label: "Break duration", value: "5 min" },
        { label: "End of day", value: "11:00 PM" },
      ].map((s) => (
        <div key={s.label} className="flex items-center justify-between">
          <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">{s.label}</span>
          <div className="flex items-center gap-[10px]">
            <div className="size-[28px] rounded-full bg-[var(--color-bg-page)] flex items-center justify-center text-[var(--color-text-primary)] text-[16px]">−</div>
            <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)] min-w-[56px] text-center">{s.value}</span>
            <div className="size-[28px] rounded-full bg-[var(--color-bg-page)] flex items-center justify-center text-[var(--color-text-primary)] text-[16px]">+</div>
          </div>
        </div>
      ))}
      <div className="border-t border-[var(--color-border-divider)]/30 pt-[12px] flex items-center gap-[8px]">
        <span className="size-[8px] rounded-full bg-[#5b8d6a] shrink-0" />
        <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)] truncate">sparkmarkphotos@gmail.com</span>
        <span className="text-[var(--color-text-secondary)] text-[var(--text-footnote)] tracking-[var(--tracking-tight)] underline ml-auto">Sign out</span>
      </div>
    </div>
  );
}

export default function DesktopDashboard() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-page)] p-[32px]" style={{ fontFamily: "var(--font-barlow, system-ui)" }}>
      <div className="max-w-[1400px] mx-auto flex flex-col gap-[24px]">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[var(--color-text-primary)] text-[28px] tracking-[-1px]">Pomodoro</h1>
          <div className="flex items-center gap-[8px]">
            <span className="size-[8px] rounded-full bg-[#5b8d6a]" />
            <span className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">Synced</span>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-[1fr_380px] gap-[24px]">
          {/* Left column */}
          <div className="flex flex-col gap-[16px]">
            {/* Timer */}
            <Timer />

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-[12px]">
              <TodaysPomos />
              <StatCard title="Today's Focus" value="0h 25m" />
              <StatCard title="Total Pomos" value="3" />
              <StatCard title="Total Focus" value="1h 12m" />
            </div>

            {/* Weekly chart */}
            <WeeklyChart />

            {/* Year heatmap */}
            <YearHeatmap />
          </div>

          {/* Right sidebar */}
          <div className="flex flex-col gap-[16px]">
            <FocusLog />
            <SettingsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
