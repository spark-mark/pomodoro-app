"use client";

import { useState } from "react";
import { signIn, signOut } from "next-auth/react";

type Mode = "sign-in" | "sign-up";

export interface AuthUIProps {
  /** Triggered after a successful sign-in so the parent can run the sync flow. */
  onSignedIn?: () => void;
}

export default function AuthUI({ onSignedIn }: AuthUIProps) {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "sign-up") {
        const res = await fetch("/api/auth/sign-up", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? "Sign-up failed");
        }
      }
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (!result || result.error) {
        throw new Error("Invalid email or password");
      }
      onSignedIn?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const altMode: Mode = mode === "sign-in" ? "sign-up" : "sign-in";

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-[10px] mt-[10px]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        className="bg-[#cec1bf]/40 text-primary placeholder-[#8f92a9] text-[15px] tracking-[-0.5px] rounded-[12px] px-[14px] py-[10px] outline-none focus:bg-[#cec1bf]/60"
      />
      <input
        type="password"
        placeholder={mode === "sign-up" ? "Password (8+ chars)" : "Password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
        className="bg-[#cec1bf]/40 text-primary placeholder-[#8f92a9] text-[15px] tracking-[-0.5px] rounded-[12px] px-[14px] py-[10px] outline-none focus:bg-[#cec1bf]/60"
      />
      {error && (
        <p className="text-danger text-[13px] tracking-[-0.5px]">{error}</p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="pressable-sm bg-primary text-inverse text-[15px] tracking-[-0.5px] rounded-[12px] py-[10px] disabled:opacity-50"
      >
        {busy ? "…" : mode === "sign-in" ? "Sign In" : "Sign Up"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(altMode);
          setError(null);
        }}
        className="pressable-sm text-muted text-[13px] tracking-[-0.5px] underline self-center"
      >
        {mode === "sign-in"
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

export interface AccountSectionProps {
  email: string | null;
  syncStatus?: "idle" | "syncing" | "synced" | "error";
  onSignedIn?: () => void;
}

export function AccountSection({
  email,
  syncStatus = "idle",
  onSignedIn,
}: AccountSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (email) {
    const statusLabel =
      syncStatus === "syncing"
        ? "Syncing…"
        : syncStatus === "error"
          ? "Sync failed"
          : "Synced";
    const dotColor =
      syncStatus === "error"
        ? "#c65c5c"
        : syncStatus === "syncing"
          ? "#a98461"
          : "#5b8d6a";
    return (
      <div className="flex flex-col gap-[8px]">
        <p className="text-muted text-[15px] tracking-[-0.84px]">Account</p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-[8px] min-w-0">
            <span
              className="size-[8px] rounded-full shrink-0"
              style={{ backgroundColor: dotColor }}
            />
            <span className="text-primary text-[15px] tracking-[-0.5px] truncate">
              {email}
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ redirect: false })}
            className="pressable-sm text-muted text-[13px] tracking-[-0.5px] underline"
          >
            Sign out
          </button>
        </div>
        <p className="text-muted text-[11px] tracking-[-0.5px]">
          {statusLabel}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[8px]">
      <p className="text-muted text-[15px] tracking-[-0.84px]">Account</p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        onPointerDown={(e) => e.stopPropagation()}
        className="pressable-sm flex items-center justify-between bg-[#cec1bf]/40 rounded-[12px] px-[14px] py-[12px]"
      >
        <span className="flex items-center gap-[10px]">
          <CloudIcon />
          <span className="text-primary text-[15px] tracking-[-0.5px]">
            Sign in to sync
          </span>
        </span>
        <span
          className="text-muted text-[16px] leading-none transition-transform"
          style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }}
        >
          ›
        </span>
      </button>
      {expanded && <AuthUI onSignedIn={onSignedIn} />}
    </div>
  );
}

function CloudIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#8f92a9"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.5 19a4.5 4.5 0 0 0 0-9 6 6 0 0 0-11.7 1.5A4.5 4.5 0 0 0 6.5 19Z" />
    </svg>
  );
}
