"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      className="spaces-print-action"
      onClick={() => window.print()}
    >
      Print / Save PDF
    </button>
  );
}
