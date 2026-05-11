"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedDigitProps {
  value: string;
}

function AnimatedDigit({ value }: AnimatedDigitProps) {
  const [display, setDisplay] = useState(value);
  const [prev, setPrev] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplay(value);
      return;
    }
    if (value === display) return;
    setPrev(display);
    setDisplay(value);
    const timeout = setTimeout(() => setPrev(null), 200);
    return () => clearTimeout(timeout);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Colon is static — no animation, inherits all styles
  if (value === ":") {
    return <span>:</span>;
  }

  return (
    <span
      className="inline-block overflow-hidden relative"
      style={{
        width: "0.62em",
        height: "1.1em",
        lineHeight: 1,
      }}
    >
      {/* Outgoing digit — slides up and blurs out */}
      {prev !== null && (
        <span
          key={`out-${prev}`}
          className="digit-exit absolute inset-x-0 top-0 flex items-center justify-center"
          style={{ height: "1.1em" }}
        >
          {prev}
        </span>
      )}
      {/* Incoming digit — slides in from below */}
      <span
        key={`in-${display}-${prev !== null}`}
        className={prev !== null ? "digit-enter" : undefined}
        style={{
          height: "1.1em",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "absolute",
          insetInline: 0,
          top: 0,
        }}
      >
        {display}
      </span>
    </span>
  );
}

interface AnimatedTimerProps {
  /** Formatted timer string, e.g. "25:00" */
  text: string;
}

export default function AnimatedTimer({ text }: AnimatedTimerProps) {
  return (
    <span
      className="inline-flex items-center justify-center"
      style={{ lineHeight: 1 }}
    >
      {text.split("").map((char, i) => (
        <AnimatedDigit key={i} value={char} />
      ))}
    </span>
  );
}
