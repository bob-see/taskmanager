"use client";

import { useEffect, useRef, useState } from "react";

export function TaskNotesButton({ notes }: { notes: string }) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    placement: "above" | "below";
    width: number;
  } | null>(null);

  function updatePosition() {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(380, window.innerWidth - 32);
    const left = Math.min(Math.max(16, rect.left), Math.max(16, window.innerWidth - width - 16));
    const placement = window.innerHeight - rect.bottom < 180 && rect.top > 180 ? "above" : "below";
    setPosition({ left, top: placement === "above" ? rect.top - 8 : rect.bottom + 8, placement, width });
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        aria-expanded={open}
        aria-label="View task notes"
        className="tm-chip inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-colors hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[color:var(--tm-card)]"
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (!open) updatePosition();
          setOpen((current) => !current);
        }}
      >
        📝
      </button>
      {open && position ? (
        <div
          ref={popoverRef}
          className="fixed z-[80] max-h-64 overflow-auto whitespace-pre-wrap rounded-[12px] border border-[color:var(--tm-border)] bg-[color:var(--tm-card)] px-3 py-2 text-xs leading-5 text-[color:var(--tm-text)] shadow-2xl"
          style={{ left: position.left, top: position.top, width: position.width, transform: position.placement === "above" ? "translateY(-100%)" : undefined }}
        >
          {notes}
        </div>
      ) : null}
    </>
  );
}
