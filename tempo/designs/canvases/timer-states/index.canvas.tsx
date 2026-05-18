import type { TempoPage, TempoStoryboard } from 'tempo-sdk';
import { SessionProvider } from 'next-auth/react';
import PomodoroScreen from '@/app/components/PomodoroScreen';

const Wrap = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider>{children}</SessionProvider>
);

const page: TempoPage = {
  name: "Timer States",
};

export default page;

export const FocusDefault: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="focus" state="default" remaining={1500} /></Wrap>,
  name: "Focus — Default",
  layout: { x: 0, y: 0, width: 393, height: 852 },
};

export const FocusRunning: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="focus" state="running" remaining={1420} /></Wrap>,
  name: "Focus — Running",
  layout: { x: 453, y: 0, width: 393, height: 852 },
};

export const FocusPaused: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="focus" state="paused" remaining={1420} /></Wrap>,
  name: "Focus — Paused",
  layout: { x: 906, y: 0, width: 393, height: 852 },
};

export const FocusStats: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="focus" state="default" remaining={1500} expanded /></Wrap>,
  name: "Focus — Stats Expanded",
  layout: { x: 1359, y: 0, width: 393, height: 852 },
};

export const BreakDefault: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="break" state="default" remaining={300} /></Wrap>,
  name: "Break — Default",
  layout: { x: 0, y: 912, width: 393, height: 852 },
};

export const BreakRunning: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="break" state="running" remaining={105} /></Wrap>,
  name: "Break — Running",
  layout: { x: 453, y: 912, width: 393, height: 852 },
};

export const BreakPaused: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="break" state="paused" remaining={105} /></Wrap>,
  name: "Break — Paused",
  layout: { x: 906, y: 912, width: 393, height: 852 },
};

export const BreakStats: TempoStoryboard = {
  render: () => <Wrap><PomodoroScreen mode="break" state="default" remaining={300} expanded /></Wrap>,
  name: "Break — Stats Expanded",
  layout: { x: 1359, y: 912, width: 393, height: 852 },
};
