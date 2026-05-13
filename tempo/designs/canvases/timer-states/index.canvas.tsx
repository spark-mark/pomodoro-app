import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import PomodoroScreen from '@/app/components/PomodoroScreen';

const page: TempoPage = {
  name: "Timer States",
};

export default page;

export const FocusDefault: TempoStoryboard = {
  render: () => <PomodoroScreen mode="focus" state="default" remaining={1500} />,
  name: "Focus — Default",
  layout: { x: 0, y: 0, width: 393, height: 852 },
};

export const FocusRunning: TempoStoryboard = {
  render: () => <PomodoroScreen mode="focus" state="running" remaining={1420} />,
  name: "Focus — Running",
  layout: { x: 453, y: 0, width: 393, height: 852 },
};

export const FocusPaused: TempoStoryboard = {
  render: () => <PomodoroScreen mode="focus" state="paused" remaining={1420} />,
  name: "Focus — Paused",
  layout: { x: 906, y: 0, width: 393, height: 852 },
};

export const FocusStats: TempoStoryboard = {
  render: () => <PomodoroScreen mode="focus" state="default" remaining={1500} expanded />,
  name: "Focus — Stats Expanded",
  layout: { x: 1359, y: 0, width: 393, height: 852 },
};

export const BreakDefault: TempoStoryboard = {
  render: () => <PomodoroScreen mode="break" state="default" remaining={300} />,
  name: "Break — Default",
  layout: { x: 0, y: 912, width: 393, height: 852 },
};

export const BreakRunning: TempoStoryboard = {
  render: () => <PomodoroScreen mode="break" state="running" remaining={105} />,
  name: "Break — Running",
  layout: { x: 453, y: 912, width: 393, height: 852 },
};

export const BreakPaused: TempoStoryboard = {
  render: () => <PomodoroScreen mode="break" state="paused" remaining={105} />,
  name: "Break — Paused",
  layout: { x: 906, y: 912, width: 393, height: 852 },
};

export const BreakStats: TempoStoryboard = {
  render: () => <PomodoroScreen mode="break" state="default" remaining={300} expanded />,
  name: "Break — Stats Expanded",
  layout: { x: 1359, y: 912, width: 393, height: 852 },
};
