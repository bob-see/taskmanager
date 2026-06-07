"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const INITIAL_SECONDS = 108 * 60;
const STORAGE_KEY = "tm-lost-countdown-state-v3";
const SESSION_KEY = "tm-lost-countdown-browser-session-v3";

type StoredLostState = {
  endAt: number;
  failure: boolean;
};

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function readStoredState(): StoredLostState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredLostState>;
    if (typeof parsed.endAt !== "number" || typeof parsed.failure !== "boolean") {
      return null;
    }

    return {
      endAt: parsed.endAt,
      failure: parsed.failure,
    };
  } catch {
    return null;
  }
}

function getSecondsUntil(endAt: number) {
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

function TimerPanel({ value }: { value: string }) {
  return (
    <span className="relative inline-flex h-7 min-w-5 items-center justify-center overflow-hidden rounded-[3px] border border-black/70 bg-[linear-gradient(180deg,#20231d_0%,#0b0d0b_50%,#171913_100%)] px-1 text-[18px] font-semibold leading-none text-zinc-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.13),inset_0_-1px_0_rgba(0,0,0,0.72)]">
      <span className="absolute inset-x-0 top-1/2 h-px bg-black/75" />
      <span className="relative">{value}</span>
    </span>
  );
}

export function HatchStatusWidget() {
  const pathname = usePathname();
  const [secondsRemaining, setSecondsRemaining] = useState(INITIAL_SECONDS);
  const [failure, setFailure] = useState(false);

  useEffect(() => {
    function readState() {
      const hasActiveBrowserSession = window.sessionStorage.getItem(SESSION_KEY) === "active";
      const storedState = readStoredState();

      if (!hasActiveBrowserSession || !storedState) {
        setSecondsRemaining(INITIAL_SECONDS);
        setFailure(false);
        return;
      }

      setSecondsRemaining(getSecondsUntil(storedState.endAt));
      setFailure(storedState.failure);
    }

    readState();
    const interval = window.setInterval(readState, 1000);
    window.addEventListener("storage", readState);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", readState);
    };
  }, []);

  const finalMinute = secondsRemaining <= 60 && secondsRemaining > 0 && !failure;
  const danger = secondsRemaining <= 120 && secondsRemaining > 0 && !failure;
  const warning = secondsRemaining <= 240 && secondsRemaining > 120 && !failure;

  if (pathname === "/lost") {
    return null;
  }

  return (
    <Link
      href="/lost"
      className={`fixed bottom-4 right-4 z-40 inline-flex items-center gap-1 rounded-[8px] border bg-[linear-gradient(180deg,#26271f_0%,#11130f_62%,#080908_100%)] px-2 py-1.5 font-mono shadow-[0_16px_34px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-black/70 transition hover:scale-[1.02] ${
        failure
          ? "border-red-300/45 shadow-[0_0_24px_rgba(248,113,113,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : finalMinute
            ? "animate-pulse border-red-300/45 shadow-[0_0_22px_rgba(248,113,113,0.22),inset_0_1px_0_rgba(255,255,255,0.08)]"
            : danger
              ? "border-red-300/35"
              : warning
                ? "border-amber-300/35"
                : "border-zinc-500/45"
      }`}
      aria-label="Open LOST hatch countdown"
    >
      {(failure ? "FAILURE" : formatCountdown(secondsRemaining)).split("").map((value, index) =>
        value === ":" ? (
          <span
            key={`${value}-${index}`}
            className="px-0.5 text-base font-semibold leading-none text-zinc-300"
          >
            :
          </span>
        ) : (
          <TimerPanel key={`${value}-${index}`} value={value} />
        )
      )}
    </Link>
  );
}
