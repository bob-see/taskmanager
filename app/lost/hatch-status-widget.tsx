"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  formatCountdown,
  type LostGlyphSlot,
  useLostTimer,
} from "@/app/lost/lost-timer-provider";

function getGlyphPath(slot: LostGlyphSlot) {
  return `/images/lost/glyphs/h${slot.glyph}-${slot.tone}-small.png`;
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
  const { failure, glyphSlots, secondsRemaining } = useLostTimer();

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
      {failure
        ? glyphSlots.map((slot, index) => (
            <span
              key={`${slot.tone}-${index}`}
              className={`relative inline-flex h-7 w-6 items-center justify-center overflow-hidden rounded-[3px] border ${
                slot.tone === "red"
                  ? "border-red-300/35 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-1px_0_rgba(0,0,0,0.86)]"
                  : "border-red-100/45 bg-red-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-4px_8px_rgba(0,0,0,0.24)]"
              }`}
            >
              <Image
                alt=""
                className={`h-5 w-5 object-contain ${
                  slot.tone === "red"
                    ? "brightness-125 saturate-150 drop-shadow-[0_0_8px_rgba(248,113,113,0.9)]"
                    : "contrast-150 brightness-75"
                } ${
                  slot.locked ? "opacity-95" : "animate-spin opacity-80"
                }`}
                height={32}
                src={getGlyphPath(slot)}
                width={32}
              />
            </span>
          ))
        : formatCountdown(secondsRemaining)
            .split("")
            .map((value, index) =>
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
