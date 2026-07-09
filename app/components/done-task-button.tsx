"use client";

import type { ButtonHTMLAttributes } from "react";

type DoneTaskButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export function DoneTaskButton({
  className = "",
  label = "Mark task done",
  type = "button",
  ...props
}: DoneTaskButtonProps) {
  return (
    <button
      {...props}
      aria-label={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-emerald-700/25 bg-[linear-gradient(135deg,rgba(236,253,245,0.92),rgba(167,243,208,0.72))] font-mono text-sm font-bold text-emerald-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_1px_3px_rgba(6,95,70,0.12)] transition hover:border-emerald-700/40 hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)] disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
      type={type}
    >
      <span aria-hidden="true">✓</span>
    </button>
  );
}
