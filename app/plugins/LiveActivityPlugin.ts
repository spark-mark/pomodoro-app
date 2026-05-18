import { registerPlugin } from "@capacitor/core";

export interface LiveActivityPlugin {
  start(options: {
    remainingSeconds: number;
    mode: "focus" | "break" | "longBreak";
  }): Promise<{ activityId: string }>;
  update(options: {
    remainingSeconds: number;
    mode: "focus" | "break" | "longBreak";
    isRunning?: boolean;
  }): Promise<void>;
  stop(options: { mode: "focus" | "break" | "longBreak" }): Promise<void>;
}

const LiveActivity = registerPlugin<LiveActivityPlugin>("LiveActivity");

export { LiveActivity };
