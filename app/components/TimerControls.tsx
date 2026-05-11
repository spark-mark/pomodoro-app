"use client";

import { useEffect, useRef, useState } from "react";
import type { PomodoroMode, PomodoroState } from "./pomodoro-types";

export interface TimerControlsProps {
  mode: PomodoroMode;
  state: PomodoroState;
  expanded?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onSkip?: () => void;
  onOpenStats?: () => void;
  onCloseStats?: () => void;
}

const ICON_BTN = "size-[50.826px] block";

/**
 * Wrapper that delays unmount so the child can play a CSS exit animation.
 */
function AnimatePresence({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(show);
  const [visible, setVisible] = useState(show);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (show) {
      setMounted(true);
      // Defer visibility to next frame so enter animation triggers
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      timeoutRef.current = setTimeout(() => setMounted(false), 200);
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [show]);

  if (!mounted) return null;

  return (
    <span
      className="control-presence inline-flex"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1)" : "scale(0.85)",
      }}
    >
      {children}
    </span>
  );
}

export default function TimerControls(props: TimerControlsProps) {
  const { mode, state, expanded, onPlay, onPause, onStop, onSkip, onOpenStats, onCloseStats } = props;

  return (
    <div className="flex items-end justify-between w-full drop-shadow-[0px_0px_22.5px_rgba(32,22,22,0.25)]">
      <div className="flex items-center gap-[7px]">
        {state === "running" ? (
          <button
            type="button"
            onClick={onPause}
            aria-label="Pause"
            className="pressable"
          >
            <img src="/pause.svg" alt="" className={ICON_BTN} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            aria-label={state === "paused" ? "Resume" : "Start"}
            className="pressable"
          >
            <img src="/play.svg" alt="" className={ICON_BTN} />
          </button>
        )}

        <AnimatePresence show={state === "paused"}>
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop"
            className="pressable"
          >
            <img src="/stop.svg" alt="" className={ICON_BTN} />
          </button>
        </AnimatePresence>

        <AnimatePresence show={state === "default" && mode === "break"}>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip break"
            className="pressable"
          >
            <img src="/skip.svg" alt="" className={ICON_BTN} />
          </button>
        </AnimatePresence>
      </div>

      {/* Stats button placeholder — keeps justify-between spacing */}
      <div className="size-[45px]" />
    </div>
  );
}
