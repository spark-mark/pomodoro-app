"use client";

import InteractivePomodoro from "./components/InteractivePomodoro";

export default function Home() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#1f2230] p-4">
      <InteractivePomodoro />
    </div>
  );
}
