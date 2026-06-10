"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import {
  FINAL_FOUR_STATUS,
  SEQUENCE,
  formatLogTime,
  type LostGlyphSlot,
  useLostTimer,
} from "@/app/lost/lost-timer-provider";

function getGlyphPath(slot: LostGlyphSlot, size: "medium" | "large") {
  return `/images/lost/glyphs/h${slot.glyph}-${slot.tone}-${size}.png`;
}

export function LostCountdownClient() {
  const {
    displayValue,
    failure,
    failureWhiteFlash,
    glyphSlots,
    inputEnabled,
    jumpTo,
    lastResetAt,
    logs,
    overrideOpen,
    playKeypress,
    rejectSequence,
    resetCountdownFromOverride,
    resetSystem,
    setOverrideOpen,
    setSoundMuted,
    soundMuted,
    status,
    successPulse,
    terminalState,
    triggerFailure,
  } = useLostTimer();
  const [sequenceFields, setSequenceFields] = useState<string[]>(() => SEQUENCE.map(() => ""));
  const [failureFlash, setFailureFlash] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  function handleFieldChange(index: number, value: string) {
    if (!inputEnabled) return;

    const normalized = value.replace(/\D/g, "").slice(0, 2);
    if (normalized.length > sequenceFields[index].length) {
      playKeypress();
    }
    setSequenceFields((current) => {
      const next = [...current];
      next[index] = normalized;
      return next;
    });

    if (normalized.length >= SEQUENCE[index].length && index < SEQUENCE.length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleFieldKeyDown(index: number, event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && sequenceFields[index] === "" && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function submitSequence(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputEnabled) return;

    const sequenceAccepted = SEQUENCE.every((value, index) => sequenceFields[index] === value);

    if (sequenceAccepted) {
      resetSystem();
      setSequenceFields(SEQUENCE.map(() => ""));
      return;
    }

    rejectSequence();
    setSequenceFields(SEQUENCE.map(() => ""));
    setFailureFlash(true);
    window.setTimeout(() => setFailureFlash(false), 700);
    inputRefs.current[0]?.focus();
  }

  return (
    <main
      className={`min-h-screen overflow-hidden text-[#d7f7b2] ${
        failure
          ? "bg-[radial-gradient(circle_at_50%_30%,rgba(127,29,29,0.32),#030101_66%)]"
          : "bg-[#030403]"
      }`}
    >
      <div className="relative min-h-screen px-4 py-6 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(73,119,72,0.2),transparent_34%),linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.028)_1px,transparent_1px)] bg-[length:auto,42px_42px,42px_42px]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_78%,rgba(125,96,43,0.12),transparent_28%),radial-gradient(circle_at_86%_18%,rgba(35,79,54,0.16),transparent_30%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(to_bottom,rgba(222,167,70,0.16),transparent)]" />

        <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl flex-col">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.34em] text-amber-200/70">
                Swan Station Personal Terminal
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f6e8ad] sm:text-4xl">
                Hatch Countdown
              </h1>
            </div>
            <div className="rounded-full border border-amber-200/15 bg-black/35 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-100/60">
              Enter the sequence in the final 4 minutes.
            </div>
          </div>

          <div className="relative flex flex-1 items-center justify-center rounded-[34px] border border-[#48513c] bg-[linear-gradient(135deg,#25271f,#080908_42%,#17130c)] p-4 shadow-[0_42px_110px_rgba(0,0,0,0.78),inset_0_0_0_1px_rgba(255,255,255,0.05),inset_0_18px_40px_rgba(255,255,255,0.035)] sm:p-7">
            <div className="absolute inset-3 rounded-[28px] border-[10px] border-[#070807] shadow-[inset_0_0_48px_rgba(0,0,0,0.95),0_0_0_1px_rgba(255,255,255,0.06)] sm:inset-5" />
            <div className="absolute inset-7 rounded-[20px] border border-amber-100/10 bg-[linear-gradient(90deg,rgba(255,255,255,0.035),transparent_18%,transparent_82%,rgba(255,255,255,0.025))]" />
            {failureWhiteFlash ? (
              <div className="pointer-events-none absolute inset-0 z-30 rounded-[34px] bg-white/90 shadow-[0_0_120px_rgba(255,255,255,0.95)]" />
            ) : null}
            <div className="pointer-events-none absolute left-10 top-9 h-2 w-2 rounded-full bg-lime-200/35 shadow-[0_0_18px_rgba(190,242,100,0.55)]" />
            <div className="pointer-events-none absolute right-10 top-9 h-2 w-2 rounded-full bg-amber-200/30 shadow-[0_0_18px_rgba(253,230,138,0.48)]" />
            <div className="relative grid w-full gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
              <div
                className={`relative overflow-hidden rounded-[24px] border p-5 shadow-[inset_0_0_56px_rgba(0,0,0,0.9),0_0_36px_rgba(0,0,0,0.45)] sm:p-8 ${
                  terminalState === "failure"
                    ? "animate-pulse border-red-500/60 bg-[radial-gradient(circle_at_50%_42%,rgba(153,27,27,0.5),#070202_64%)]"
                  : successPulse
                      ? "border-lime-200/60 bg-[radial-gradient(circle_at_50%_42%,rgba(101,163,13,0.35),#031006_66%)]"
                      : failureFlash
                        ? "border-amber-200/60 bg-[radial-gradient(circle_at_50%_42%,rgba(180,83,9,0.38),#080704_66%)]"
                        : terminalState === "heartbeat"
                          ? "animate-[heartbeat_0.9s_ease-in-out_infinite] border-red-300/60 bg-[radial-gradient(circle_at_50%_42%,rgba(153,27,27,0.42),#050806_66%)]"
                        : terminalState === "critical"
                          ? "animate-pulse border-red-400/55 bg-[radial-gradient(circle_at_50%_42%,rgba(127,29,29,0.36),#050806_66%)]"
                          : terminalState === "danger"
                            ? "border-red-400/42 bg-[radial-gradient(circle_at_50%_42%,rgba(127,29,29,0.28),#050d07_66%)]"
                            : terminalState === "warning"
                              ? "border-amber-300/45 bg-[radial-gradient(circle_at_50%_42%,rgba(120,81,28,0.3),#051006_64%)]"
                              : "border-lime-200/25 bg-[radial-gradient(circle_at_50%_42%,rgba(71,115,63,0.25),#031006_66%)]"
                }`}
              >
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[length:100%_7px] opacity-30" />
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.04)_48%,transparent_52%)] opacity-20" />
                <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.08),transparent_58%)] opacity-35" />
                <div className="pointer-events-none absolute inset-0 shadow-[inset_0_0_90px_rgba(0,0,0,0.94)]" />

                <div className="relative flex min-h-[28rem] flex-col items-center justify-center gap-5 text-center sm:min-h-[32rem]">
                  {failure ? (
                    <>
                      <div className="font-mono text-3xl font-semibold uppercase tracking-[0.28em] text-red-200 drop-shadow-[0_0_18px_rgba(248,113,113,0.75)] sm:text-5xl">
                        SYSTEM FAILURE
                      </div>
                      <div className="space-y-2 font-mono text-sm uppercase tracking-[0.28em] text-red-100/85 sm:text-base">
                        <div>Sequence not entered</div>
                        <div>Initiating lockdown</div>
                      </div>
                      <div className="w-full border-y border-red-400/30 bg-black/45 px-2 py-4 shadow-[inset_0_0_28px_rgba(0,0,0,0.8)] sm:px-5 sm:py-6">
                        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 sm:gap-4">
                          {glyphSlots.map((slot, index) => (
                            <div
                              key={`${slot.tone}-${index}`}
                              className={`flex aspect-square w-[17.5%] max-w-[7.75rem] min-w-12 items-center justify-center rounded-[8px] border transition ${
                                slot.tone === "red"
                                  ? slot.locked
                                    ? "border-red-300/45 bg-[linear-gradient(180deg,#050101,#100202_54%,#020101)] shadow-[0_0_24px_rgba(248,113,113,0.26),inset_0_0_22px_rgba(0,0,0,0.92)]"
                                    : "border-red-400/30 bg-[linear-gradient(180deg,#040101,#0b0101_54%,#020101)] shadow-[inset_0_0_22px_rgba(0,0,0,0.92)]"
                                  : slot.locked
                                    ? "border-red-100/55 bg-[linear-gradient(180deg,#dc2626,#991b1b_58%,#5f0909)] shadow-[0_0_28px_rgba(248,113,113,0.38),inset_0_1px_0_rgba(255,255,255,0.28),inset_0_-8px_18px_rgba(0,0,0,0.28)]"
                                    : "border-red-100/42 bg-[linear-gradient(180deg,#c91f1f,#7f1111_58%,#4f0707)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),inset_0_-8px_18px_rgba(0,0,0,0.28)]"
                              }`}
                            >
                              <Image
                                alt=""
                                className={`h-[82%] w-[82%] object-contain ${
                                  slot.tone === "red"
                                    ? "brightness-125 saturate-150 drop-shadow-[0_0_18px_rgba(248,113,113,0.95)]"
                                    : "contrast-150 brightness-75 drop-shadow-[0_2px_0_rgba(255,255,255,0.12)]"
                                } ${
                                  slot.locked ? "opacity-100" : "animate-[glyph_spin_0.42s_linear_infinite] opacity-90"
                                }`}
                                height={128}
                                src={getGlyphPath(slot, "large")}
                                width={128}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-[14px] border border-red-200/55 bg-red-500/24 px-6 py-4 font-mono text-sm font-semibold uppercase tracking-[0.22em] text-red-50 shadow-[0_0_24px_rgba(248,113,113,0.28)] transition hover:bg-red-500/34"
                        onClick={() => {
                          resetCountdownFromOverride();
                          setSequenceFields(SEQUENCE.map(() => ""));
                        }}
                      >
                        Reset system
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        className={`max-w-[96%] whitespace-nowrap font-mono text-[clamp(3.9rem,10.8vw,8.9rem)] font-bold leading-none tracking-[-0.005em] ${
                          terminalState === "heartbeat"
                            ? "text-red-100 drop-shadow-[0_0_36px_rgba(248,113,113,0.78)]"
                          : terminalState === "critical"
                            ? "text-red-100 drop-shadow-[0_0_32px_rgba(248,113,113,0.68)]"
                            : terminalState === "danger"
                              ? "text-red-100 drop-shadow-[0_0_28px_rgba(248,113,113,0.5)]"
                              : terminalState === "warning"
                                ? "text-amber-100 drop-shadow-[0_0_28px_rgba(251,191,36,0.5)]"
                                : "text-[#dfffbf] drop-shadow-[0_0_28px_rgba(163,230,53,0.46)]"
                        }`}
                      >
                        {displayValue}
                      </div>
                      <div
                        className={`font-mono text-sm uppercase tracking-[0.28em] ${
                          terminalState === "heartbeat"
                            ? "text-red-100"
                          : terminalState === "critical"
                            ? "text-red-100"
                            : terminalState === "danger"
                              ? "text-red-200"
                              : terminalState === "warning"
                                ? "text-amber-200"
                                : "text-lime-100/70"
                        }`}
                      >
                        {terminalState === "heartbeat"
                          ? "System failure imminent"
                          : terminalState === "critical"
                          ? "Critical window"
                          : terminalState === "danger"
                            ? "Warning: countdown breach imminent"
                            : terminalState === "warning"
                              ? "Execute sequence"
                              : "System countdown active"}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <aside className="rounded-[22px] border border-amber-100/15 bg-[linear-gradient(180deg,rgba(0,0,0,0.58),rgba(18,15,10,0.72))] p-4 shadow-[inset_0_0_28px_rgba(0,0,0,0.8),0_14px_32px_rgba(0,0,0,0.28)]">
                <div className="mb-5 grid grid-cols-3 gap-2">
                  {Array.from({ length: 9 }, (_, index) => (
                    <div
                      key={index}
                      className={`h-3 rounded-full border ${
                        terminalState === "failure"
                          ? "border-red-400/40 bg-red-500/30"
                          : terminalState === "heartbeat" || terminalState === "critical" || terminalState === "danger"
                            ? "border-red-300/45 bg-red-400/30"
                            : terminalState === "warning"
                              ? "border-amber-300/45 bg-amber-300/30"
                              : "border-lime-200/25 bg-lime-300/20"
                      }`}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="mb-5 inline-flex w-full items-center justify-center gap-2 rounded-[12px] border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-lime-100/60 transition hover:bg-white/[0.06]"
                  onClick={() => setSoundMuted(!soundMuted)}
                >
                  <span aria-hidden="true">{soundMuted ? "🔇" : "🔊"}</span>
                  {soundMuted ? "Audio muted" : "Audio armed"}
                </button>

                <form className="space-y-3.5" onSubmit={submitSequence}>
                  <label className="block font-mono text-xs uppercase tracking-[0.22em] text-amber-100/70">
                    Sequence
                  </label>
                  <div className="grid grid-cols-6 gap-1.5">
                    {SEQUENCE.map((expected, index) => (
                      <input
                        key={`${expected}-${index}`}
                        ref={(node) => {
                          inputRefs.current[index] = node;
                        }}
                        aria-label={`Sequence number ${index + 1}`}
                        className={`h-11 min-w-0 rounded-[10px] border bg-[#050805] px-1 text-center font-mono text-sm outline-none transition sm:text-base ${
                          inputEnabled
                            ? terminalState === "heartbeat" || terminalState === "critical" || terminalState === "danger"
                              ? "border-red-300/60 text-red-100 shadow-[0_0_20px_rgba(248,113,113,0.24)]"
                              : "border-amber-300/60 text-amber-100 shadow-[0_0_22px_rgba(245,158,11,0.24)]"
                            : "border-lime-200/15 text-lime-100/35"
                        }`}
                        disabled={!inputEnabled}
                        inputMode="numeric"
                        maxLength={2}
                        value={sequenceFields[index]}
                        onChange={(event) => handleFieldChange(index, event.target.value)}
                        onKeyDown={(event) => handleFieldKeyDown(index, event)}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    disabled={!inputEnabled}
                    className={`w-full rounded-[12px] border px-4 py-3 font-mono text-sm uppercase tracking-[0.18em] transition enabled:hover:bg-amber-200/18 disabled:cursor-not-allowed disabled:opacity-40 ${
                      inputEnabled
                        ? terminalState === "heartbeat" || terminalState === "critical" || terminalState === "danger"
                          ? "animate-pulse border-red-300/45 bg-red-500/16 text-red-100 shadow-[0_0_24px_rgba(248,113,113,0.24)]"
                          : "animate-pulse border-amber-200/45 bg-amber-200/14 text-amber-100 shadow-[0_0_24px_rgba(245,158,11,0.22)]"
                        : "border-amber-200/25 bg-amber-200/10 text-amber-100"
                    }`}
                  >
                    Execute
                  </button>
                </form>

                <div
                  className={`mt-6 rounded-[14px] border px-3 py-3 font-mono text-sm ${
                    terminalState === "failure"
                      ? "border-red-400/35 bg-red-950/35 text-red-200"
                      : status === "Incorrect sequence."
                        ? "border-amber-300/35 bg-amber-950/30 text-amber-100"
                        : terminalState === "heartbeat" || terminalState === "critical" || terminalState === "danger"
                          ? "border-red-300/40 bg-red-950/28 text-red-100 shadow-[0_0_22px_rgba(248,113,113,0.16)]"
                          : terminalState === "warning"
                            ? "border-amber-300/40 bg-amber-950/28 text-amber-100 shadow-[0_0_22px_rgba(245,158,11,0.16)]"
                            : "border-lime-200/18 bg-lime-950/20 text-lime-100/75"
                  }`}
                >
                  {failure ? "SYSTEM FAILURE" : status}
                </div>

                <div className="mt-4 rounded-[14px] border border-white/10 bg-white/[0.03] p-3 font-mono text-xs leading-5 text-lime-100/55">
                  {lastResetAt ? (
                    <>
                      <div className="mb-2 uppercase tracking-[0.18em] text-amber-100/55">
                        Last accepted entry
                      </div>
                      <div className="text-lime-100/80">4 8 15 16 23 42</div>
                      <div className="mt-2 text-lime-100/65">
                        {new Date(lastResetAt).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                      <div className="text-lime-100/65">
                        {new Date(lastResetAt).toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="uppercase tracking-[0.18em] text-amber-100/55">
                      No accepted entry
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-[14px] border border-white/10 bg-white/[0.03] p-3 font-mono text-xs leading-5 text-lime-100/55">
                  Input remains locked until the final four minutes. Refreshing or navigating back keeps
                  the active countdown for this browser session.
                </div>

                <section className="mt-4 rounded-[14px] border border-lime-100/12 bg-black/35 p-3">
                  <h2 className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-amber-100/60">
                    System log
                  </h2>
                  <div className="max-h-36 space-y-1 overflow-y-auto pr-1 font-mono text-xs leading-5 text-lime-100/65">
                    {logs.length === 0 ? (
                      <div>No system events.</div>
                    ) : (
                      logs.map((log) => (
                        <div key={log.id}>
                          <span className="text-amber-100/55">[{formatLogTime(log.timestamp)}]</span>{" "}
                          {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </aside>
            </div>
          </div>
        </section>
      </div>
      {overrideOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-[22px] border border-amber-200/25 bg-[linear-gradient(180deg,#11130d,#050604)] p-5 font-mono text-amber-100 shadow-[0_0_48px_rgba(245,158,11,0.16)]">
            <div className="border-b border-amber-200/15 pb-4">
              <div className="text-xs uppercase tracking-[0.28em] text-amber-100/60">
                Dharma Initiative
              </div>
              <h2 className="mt-2 text-xl font-semibold uppercase tracking-[0.18em]">
                Maintenance Override
              </h2>
            </div>

            <div className="mt-5 grid gap-3">
              <button
                type="button"
                className="rounded-[12px] border border-amber-300/30 bg-amber-200/10 px-4 py-3 text-left text-sm uppercase tracking-[0.12em] transition hover:bg-amber-200/18"
                onClick={() => {
                  jumpTo(240, "Test override: final four minutes activated.", FINAL_FOUR_STATUS);
                  setSequenceFields(SEQUENCE.map(() => ""));
                  window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
                }}
              >
                Activate Final Four Minute Protocol
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-red-300/30 bg-red-500/12 px-4 py-3 text-left text-sm uppercase tracking-[0.12em] transition hover:bg-red-500/20"
                onClick={() => {
                  triggerFailure("Failure triggered.");
                  setSequenceFields(SEQUENCE.map(() => ""));
                }}
              >
                Trigger System Failure
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-lime-200/25 bg-lime-300/10 px-4 py-3 text-left text-sm uppercase tracking-[0.12em] transition hover:bg-lime-300/16"
                onClick={() => {
                  resetCountdownFromOverride();
                  setSequenceFields(SEQUENCE.map(() => ""));
                }}
              >
                Reset Countdown
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm uppercase tracking-[0.12em] text-amber-100/70 transition hover:bg-white/[0.07]"
                onClick={() => setOverrideOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        @keyframes glyph_spin {
          from {
            transform: rotate(0deg) scale(0.94);
          }
          to {
            transform: rotate(360deg) scale(1.04);
          }
        }
        @keyframes heartbeat {
          0%,
          100% {
            box-shadow:
              inset 0 0 56px rgba(0, 0, 0, 0.9),
              0 0 24px rgba(248, 113, 113, 0.12);
          }
          40% {
            box-shadow:
              inset 0 0 56px rgba(0, 0, 0, 0.9),
              0 0 42px rgba(248, 113, 113, 0.34);
          }
        }
      `}</style>
    </main>
  );
}
