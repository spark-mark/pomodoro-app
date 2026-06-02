"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SessionEntry } from "./pomodoro-types";

const SLICE_COUNT = 72;
const DEG_PER_SLICE = 360 / SLICE_COUNT;
const RADIUS = 200;
const SLICE_WIDTH = Math.ceil((2 * Math.PI * RADIUS) / SLICE_COUNT) + 1;
const FRICTION = 0.92;
const MIN_VELOCITY = 0.05;

function hoursOfDay(timestamp: number): number {
  const d = new Date(timestamp);
  return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
}

function timeToSliceIndex(hours: number): number {
  return Math.floor(hours * 3) % SLICE_COUNT;
}

type SliceState =
  | "empty"
  | "completed"
  | "in-progress-filled"
  | "in-progress-outline";

interface CylindricalTimelineProps {
  sessions: SessionEntry[];
  focusDurationSeconds: number;
  currentSessionStart: number | null;
  currentSessionElapsed: number;
  now: number;
}

export default function CylindricalTimeline({
  sessions,
  focusDurationSeconds,
  currentSessionStart,
  currentSessionElapsed,
}: CylindricalTimelineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const [angle, setAngle] = useState(0);
  const dragging = useRef(false);
  const lastX = useRef(0);
  const velocity = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    const nowSlice = timeToSliceIndex(hoursOfDay(Date.now()));
    const a = -(nowSlice * DEG_PER_SLICE);
    angleRef.current = a;
    setAngle(a);
  }, []);

  const [realNow, setRealNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setRealNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const playheadSlice = timeToSliceIndex(hoursOfDay(realNow));

  const sliceStates = useMemo<SliceState[]>(() => {
    const states: SliceState[] = new Array(SLICE_COUNT).fill("empty");

    for (const session of sessions) {
      const startHour = hoursOfDay(session.startTime);
      const startSlice = timeToSliceIndex(startHour);
      const count = Math.max(1, Math.ceil(session.durationSeconds / (20 * 60)));
      for (let j = 0; j < count; j++) {
        states[(startSlice + j) % SLICE_COUNT] = "completed";
      }
    }

    if (currentSessionStart !== null) {
      const startSlice = timeToSliceIndex(hoursOfDay(currentSessionStart));
      const plannedSlices = Math.max(
        1,
        Math.ceil(focusDurationSeconds / (20 * 60)),
      );
      const playheadDist =
        ((playheadSlice - startSlice) % SLICE_COUNT + SLICE_COUNT) %
        SLICE_COUNT;

      for (let j = 0; j < plannedSlices; j++) {
        const si = (startSlice + j) % SLICE_COUNT;
        if (j <= playheadDist) {
          states[si] = "in-progress-filled";
        } else if (states[si] === "empty") {
          states[si] = "in-progress-outline";
        }
      }
    }

    return states;
  }, [
    sessions,
    currentSessionStart,
    focusDurationSeconds,
    playheadSlice,
  ]);

  const momentum = useCallback(() => {
    if (Math.abs(velocity.current) < MIN_VELOCITY) return;
    velocity.current *= FRICTION;
    angleRef.current += velocity.current;
    setAngle(angleRef.current);
    raf.current = requestAnimationFrame(momentum);
  }, []);

  const startPos = useRef({ x: 0, y: 0 });
  const locked = useRef<"h" | "v" | null>(null);
  const LOCK_THRESHOLD = 6;

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    locked.current = null;
    lastX.current = e.clientX;
    startPos.current = { x: e.clientX, y: e.clientY };
    velocity.current = 0;
    cancelAnimationFrame(raf.current);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return;

    if (!locked.current) {
      const dx = Math.abs(e.clientX - startPos.current.x);
      const dy = Math.abs(e.clientY - startPos.current.y);
      if (dx < LOCK_THRESHOLD && dy < LOCK_THRESHOLD) return;
      locked.current = dx >= dy ? "h" : "v";
      if (locked.current === "h") {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }
    }

    if (locked.current === "v") return;

    const dx = e.clientX - lastX.current;
    lastX.current = e.clientX;
    const delta = (dx / containerRef.current.clientWidth) * 90;
    velocity.current = delta;
    angleRef.current += delta;
    setAngle(angleRef.current);
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const wasHorizontal = locked.current === "h";
    dragging.current = false;
    locked.current = null;
    if (wasHorizontal) {
      raf.current = requestAnimationFrame(momentum);
    }
  }, [momentum]);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  return (
    <div
      ref={containerRef}
      className="h-[56px] overflow-hidden w-full relative rounded-[12px]"
      style={{
        background: "white",
        border: "1px solid #b5bbf5",
        touchAction: "pan-y",
      }}
      data-scrollable-x=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{ perspective: 1200 }}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateY(${angle}deg)`,
            willChange: "transform",
            position: "relative",
            width: 0,
            height: "100%",
          }}
        >
          {Array.from({ length: SLICE_COUNT }).map((_, i) => {
            const state = sliceStates[i];
            const isPlayhead = i === playheadSlice;
            const isHourMark = i % 3 === 0;
            const hour = i / 3;

            const worldAngle =
              (((i * DEG_PER_SLICE + angle) % 360) + 360) % 360;
            const fromFront =
              worldAngle > 180 ? 360 - worldAngle : worldAngle;
            const labelOpacity =
              fromFront > 70 ? 0 : fromFront > 50 ? (70 - fromFront) / 20 : 1;

            let bg: string;
            let border: string | undefined;
            if (state === "completed" || state === "in-progress-filled") {
              bg = "#5b6196";
            } else if (state === "in-progress-outline") {
              bg = "rgba(91,97,150,0.15)";
              border = "1px solid rgba(91,97,150,0.4)";
            } else {
              bg = "transparent";
            }

            let label = "";
            if (isHourMark) {
              const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
              label = `${h12}${hour < 12 ? "a" : "p"}`;
            }

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: SLICE_WIDTH,
                  height: "100%",
                  left: -SLICE_WIDTH / 2,
                  transform: `rotateY(${i * DEG_PER_SLICE}deg) translateZ(${RADIUS}px)`,
                  backfaceVisibility: "hidden",
                }}
              >
                {/* Session fill */}
                <div
                  style={{
                    position: "absolute",
                    top: "22%",
                    left: 0,
                    right: 0,
                    height: "36%",
                    background: bg,
                    border,
                    borderRadius: 1,
                  }}
                />

                {isHourMark && (
                  <div
                    style={{
                      position: "absolute",
                      top: "18%",
                      left: "50%",
                      width: 0,
                      height: "42%",
                      borderLeft: "1px dotted rgba(115,121,179,0.3)",
                      transform: "translateX(-50%)",
                    }}
                  />
                )}

                {isPlayhead && (
                  <div
                    style={{
                      position: "absolute",
                      top: "14%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      zIndex: 10,
                    }}
                  >
                    <div
                      className="bg-danger"
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                      }}
                    />
                    <div
                      className="bg-danger"
                      style={{ width: 1.5, height: 18 }}
                    />
                  </div>
                )}

                {isHourMark && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "14%",
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 9,
                      color: "#7379b3",
                      letterSpacing: -0.5,
                      whiteSpace: "nowrap",
                      opacity: labelOpacity,
                      lineHeight: 1,
                    }}
                  >
                    {label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Lighting: darkened edges, illuminated center */}
      <div
        className="absolute inset-0 z-10 pointer-events-none rounded-[12px]"
        style={{
          background:
            "linear-gradient(to right, rgba(80,85,120,0.35) 0%, rgba(80,85,120,0.08) 15%, transparent 30%, transparent 70%, rgba(80,85,120,0.08) 85%, rgba(80,85,120,0.35) 100%)",
        }}
      />
    </div>
  );
}
