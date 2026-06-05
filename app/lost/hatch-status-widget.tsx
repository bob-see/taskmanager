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
      className={`fixed bottom-4 right-4 z-40 rounded-[14px] border px-3 py-2 font-mono text-sm shadow-[0_14px_32px_rgba(0,0,0,0.28)] transition hover:scale-[1.02] ${
        failure
          ? "border-red-300/45 bg-red-950/85 text-red-100 shadow-[0_0_24px_rgba(248,113,113,0.25)]"
          : finalMinute
            ? "animate-pulse border-red-300/45 bg-red-950/80 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.22)]"
            : danger
              ? "border-red-300/35 bg-red-950/75 text-red-100"
              : warning
                ? "border-amber-300/35 bg-amber-950/75 text-amber-100"
                : "border-lime-200/25 bg-lime-950/75 text-lime-100"
      }`}
      aria-label="Open LOST hatch countdown"
    >
      {failure ? "FAILURE" : formatCountdown(secondsRemaining)}
    </Link>
  );
}
