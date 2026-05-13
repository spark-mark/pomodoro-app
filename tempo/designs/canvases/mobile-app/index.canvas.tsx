import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import PomodoroScreen from '@/app/components/PomodoroScreen';
import InteractivePomodoro from '@/app/components/InteractivePomodoro';
import type { PomodoroStats, SessionEntry } from '@/app/components/pomodoro-types';

const page: TempoPage = {
  name: "Mobile App",
};

export default page;

/* ── Sample data helpers ── */

function todayAt(hour: number, minute = 0): number {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

// Fresh start — no sessions
const EMPTY_STATS: PomodoroStats = {
  todayPomos: 0,
  todayFocusMinutes: 0,
  totalPomos: 0,
  totalFocusMinutes: 0,
  todaySessions: [],
  weeklyFocusMinutes: [0, 0, 0, 0, 0, 0, 0],
};

// Morning session — 2 pomos
const MORNING_SESSIONS: SessionEntry[] = [
  { startTime: todayAt(9, 0), durationSeconds: 1500 },
  { startTime: todayAt(9, 30), durationSeconds: 1500 },
];
const MORNING_STATS: PomodoroStats = {
  todayPomos: 2,
  todayFocusMinutes: 50,
  totalPomos: 16,
  totalFocusMinutes: 480,
  todaySessions: MORNING_SESSIONS,
  weeklyFocusMinutes: [25, 75, 100, 50, 125, 60, 50],
};

// Full study day — 10 pomos across the day
const FULL_DAY_SESSIONS: SessionEntry[] = [
  { startTime: todayAt(8, 0), durationSeconds: 1500 },
  { startTime: todayAt(8, 30), durationSeconds: 1500 },
  { startTime: todayAt(9, 0), durationSeconds: 1500 },
  { startTime: todayAt(9, 30), durationSeconds: 1500 },
  { startTime: todayAt(11, 0), durationSeconds: 1500 },
  { startTime: todayAt(11, 30), durationSeconds: 1500 },
  { startTime: todayAt(14, 0), durationSeconds: 1500 },
  { startTime: todayAt(14, 30), durationSeconds: 1500 },
  { startTime: todayAt(16, 0), durationSeconds: 1500 },
  { startTime: todayAt(16, 30), durationSeconds: 1500 },
];
const FULL_DAY_STATS: PomodoroStats = {
  todayPomos: 10,
  todayFocusMinutes: 250,
  totalPomos: 214,
  totalFocusMinutes: 6755,
  todaySessions: FULL_DAY_SESSIONS,
  weeklyFocusMinutes: [120, 180, 240, 200, 300, 360, 250],
};

export const Interactive: TempoStoryboard = {
  render: () => (
    <InteractivePomodoro storageKey="pomodoro-mobile.canvas" speed={30} />
  ),
  name: "Interactive (30× speed)",
  layout: { x: 0, y: 0, width: 393, height: 852 },
};

/* ── Data state storyboards ── */

export const EmptyCollapsed: TempoStoryboard = {
  render: () => (
    <PomodoroScreen
      mode="focus"
      state="default"
      remaining={1500}
      stats={EMPTY_STATS}
      weeklyGoalMinutes={1050}
    />
  ),
  name: "Empty — Collapsed",
  layout: { x: 453, y: 0, width: 393, height: 852 },
};

export const EmptyExpanded: TempoStoryboard = {
  render: () => (
    <PomodoroScreen
      mode="focus"
      state="default"
      remaining={1500}
      stats={EMPTY_STATS}
      weeklyGoalMinutes={1050}
      expanded
    />
  ),
  name: "Empty — Expanded",
  layout: { x: 906, y: 0, width: 393, height: 852 },
};

export const MorningCollapsed: TempoStoryboard = {
  render: () => (
    <PomodoroScreen
      mode="focus"
      state="default"
      remaining={1500}
      stats={MORNING_STATS}
      weeklyGoalMinutes={1050}
      simNow={todayAt(10, 15)}
    />
  ),
  name: "Morning (2 pomos) — Collapsed",
  layout: { x: 1359, y: 0, width: 393, height: 852 },
};

export const MorningExpanded: TempoStoryboard = {
  render: () => (
    <PomodoroScreen
      mode="focus"
      state="default"
      remaining={1500}
      stats={MORNING_STATS}
      weeklyGoalMinutes={1050}
      simNow={todayAt(10, 15)}
      expanded
    />
  ),
  name: "Morning (2 pomos) — Expanded",
  layout: { x: 1812, y: 0, width: 393, height: 852 },
};

export const FullDayCollapsed: TempoStoryboard = {
  render: () => (
    <PomodoroScreen
      mode="focus"
      state="default"
      remaining={1500}
      stats={FULL_DAY_STATS}
      weeklyGoalMinutes={1050}
      simNow={todayAt(17, 0)}
    />
  ),
  name: "Full Day (10 pomos) — Collapsed",
  layout: { x: 0, y: 912, width: 393, height: 852 },
};

export const FullDayExpanded: TempoStoryboard = {
  render: () => (
    <PomodoroScreen
      mode="focus"
      state="default"
      remaining={1500}
      stats={FULL_DAY_STATS}
      weeklyGoalMinutes={1050}
      simNow={todayAt(17, 0)}
      expanded
    />
  ),
  name: "Full Day (10 pomos) — Expanded",
  layout: { x: 453, y: 912, width: 393, height: 852 },
};
