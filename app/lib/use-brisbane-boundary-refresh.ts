"use client";

import { useEffect, useRef } from "react";
import { millisecondsUntilNextBrisbaneDay } from "@/app/lib/date-time";

type BoundaryDelay = (value: Date) => number;
type BoundaryRefresh = (value: Date) => void;

/** Refresh after hydration at a Brisbane boundary and when the page becomes active. */
export function useBrisbaneBoundaryRefresh(
  refresh: BoundaryRefresh,
  getDelay: BoundaryDelay = millisecondsUntilNextBrisbaneDay
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let timeoutId: number | null = null;

    function schedule(now: Date) {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(() => {
        refreshAndSchedule();
      }, getDelay(now) + 100);
    }

    function refreshAndSchedule() {
      const now = new Date();
      refreshRef.current(now);
      schedule(now);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        refreshAndSchedule();
      }
    }

    refreshAndSchedule();
    window.addEventListener("focus", refreshAndSchedule);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      window.removeEventListener("focus", refreshAndSchedule);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [getDelay]);
}
