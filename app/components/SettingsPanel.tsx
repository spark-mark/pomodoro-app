"use client";

import { type PomodoroSettings, DEFAULT_SETTINGS } from "./pomodoro-types";
import { AccountSection } from "./AuthUI";
import { tapHaptic } from "./haptics";
import type { SyncStatus } from "./useSync";

interface SettingRowProps {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function SettingRow({ label, value, unit, min, max, step, onChange }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-[var(--space-lg)]">
      <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">{label}</span>
      <div className="flex items-center gap-[10px]">
        <button
          type="button"
          onClick={() => { tapHaptic(); onChange(Math.max(min, value - step)); }}
          className="pressable-sm size-[28px] rounded-full bg-[#cec1bf]/60 text-[var(--color-text-primary)] text-[16px] flex items-center justify-center"
        >
          −
        </button>
        <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)] min-w-[48px] text-center tabular-nums">
          {value} {unit}
        </span>
        <button
          type="button"
          onClick={() => { tapHaptic(); onChange(Math.min(max, value + step)); }}
          className="pressable-sm size-[28px] rounded-full bg-[#cec1bf]/60 text-[var(--color-text-primary)] text-[16px] flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  const wholeHour = Math.floor(h);
  const hasHalf = h % 1 !== 0;
  const hr12 = wholeHour === 0 ? 12 : wholeHour > 12 ? wholeHour - 12 : wholeHour;
  const suffix = wholeHour < 12 ? "AM" : "PM";
  return `${hr12}:${hasHalf ? "30" : "00"} ${suffix}`;
}

export interface SettingsPanelProps {
  settings: PomodoroSettings;
  onChange: (settings: PomodoroSettings) => void;
  userEmail?: string | null;
  syncStatus?: SyncStatus;
  onSignedIn?: () => void;
}

export default function SettingsPanel({ settings, onChange, userEmail, syncStatus, onSignedIn }: SettingsPanelProps) {
  const update = <K extends keyof PomodoroSettings>(key: K, value: PomodoroSettings[K]) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div
      className="px-[18px] pb-[32px] flex flex-col"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="text-[var(--color-text-secondary)] text-[var(--text-body)] tracking-[var(--tracking-title)] mb-[4px]">
        Settings
      </p>

      <div className="divide-y divide-[var(--color-border-divider)]/30">
        <SettingRow
          label="Daily study goal"
          value={settings.dailyGoalHours}
          unit="hrs"
          min={1}
          max={12}
          step={1}
          onChange={(v) => update("dailyGoalHours", v)}
        />
        <SettingRow
          label="Focus duration"
          value={settings.focusDurationMinutes}
          unit="min"
          min={5}
          max={90}
          step={5}
          onChange={(v) => update("focusDurationMinutes", v)}
        />
        <SettingRow
          label="Short break"
          value={settings.breakDurationMinutes}
          unit="min"
          min={1}
          max={30}
          step={1}
          onChange={(v) => update("breakDurationMinutes", v)}
        />
        <SettingRow
          label="Long break"
          value={settings.longBreakDurationMinutes ?? 15}
          unit="min"
          min={5}
          max={60}
          step={5}
          onChange={(v) => update("longBreakDurationMinutes", v)}
        />
        <SettingRow
          label="Long break every"
          value={settings.longBreakInterval ?? 3}
          unit="pomos"
          min={2}
          max={8}
          step={1}
          onChange={(v) => update("longBreakInterval", v)}
        />
        <div className="flex items-center justify-between py-[var(--space-lg)]">
          <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)]">End of day</span>
          <div className="flex items-center gap-[10px]">
            <button
              type="button"
              onClick={() => { tapHaptic(); update("endOfDayHour", Math.max(18, settings.endOfDayHour - 0.5)); }}
              className="pressable-sm size-[28px] rounded-full bg-[#cec1bf]/60 text-[var(--color-text-primary)] text-[16px] flex items-center justify-center"
            >
              −
            </button>
            <span className="text-[var(--color-text-primary)] text-[var(--text-body)] tracking-[var(--tracking-tight)] min-w-[72px] text-center tabular-nums">
              {formatHour(settings.endOfDayHour)}
            </span>
            <button
              type="button"
              onClick={() => { tapHaptic(); update("endOfDayHour", Math.min(24, settings.endOfDayHour + 0.5)); }}
              className="pressable-sm size-[28px] rounded-full bg-[#cec1bf]/60 text-[var(--color-text-primary)] text-[16px] flex items-center justify-center"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-[20px]">
        <AccountSection email={userEmail ?? null} syncStatus={syncStatus} onSignedIn={onSignedIn} />
      </div>
    </div>
  );
}
