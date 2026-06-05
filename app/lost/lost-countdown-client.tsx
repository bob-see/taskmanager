"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const INITIAL_SECONDS = 108 * 60;
const FINAL_WINDOW_SECONDS = 4 * 60;
const SEQUENCE = ["4", "8", "15", "16", "23", "42"] as const;
const FAILURE_SYMBOLS = ["𓂀", "𓊽", "𓆣", "𓃭", "𓏏", "𓇳", "𓁹", "𓎛"];
const STORAGE_KEY = "tm-lost-countdown-state-v3";
const SESSION_KEY = "tm-lost-countdown-browser-session-v3";
const LOCKED_STATUS = "Input remains locked until the final four minutes.";
const FINAL_FOUR_STATUS = "ENTER THE NUMBERS";
const FINAL_MINUTE_STATUS = "SYSTEM FAILURE IMMINENT";

type LogEntry = {
  id: string;
  message: string;
  timestamp: number;
};

type StoredLostState = {
  endAt: number;
  failure: boolean;
  lastResetAt: number | null;
  logs: LogEntry[];
  status: string;
};

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatLogTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createLog(message: string, timestamp = Date.now()): LogEntry {
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
    message,
    timestamp,
  };
}

function createInitialState(message = "Countdown initiated."): StoredLostState {
  const now = Date.now();

  return {
    endAt: now + INITIAL_SECONDS * 1000,
    failure: false,
    lastResetAt: null,
    logs: [createLog(message, now)],
    status: LOCKED_STATUS,
  };
}

function resetStateWithLog(message: string): StoredLostState {
  const now = Date.now();

  return {
    endAt: now + INITIAL_SECONDS * 1000,
    failure: false,
    lastResetAt: null,
    logs: [createLog(message, now), createLog("Countdown started.", now)],
    status: LOCKED_STATUS,
  };
}

function readStoredState(): StoredLostState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredLostState>;
    if (
      typeof parsed.endAt !== "number" ||
      typeof parsed.failure !== "boolean" ||
      !Array.isArray(parsed.logs) ||
      typeof parsed.status !== "string"
    ) {
      return null;
    }

    return {
      endAt: parsed.endAt,
      failure: parsed.failure,
      lastResetAt: typeof parsed.lastResetAt === "number" ? parsed.lastResetAt : null,
      logs: parsed.logs.filter(
        (log): log is LogEntry =>
          typeof log?.id === "string" &&
          typeof log.message === "string" &&
          typeof log.timestamp === "number"
      ),
      status: parsed.status,
    };
  } catch {
    return null;
  }
}

function writeStoredState(state: StoredLostState) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...state,
      logs: state.logs.slice(0, 20),
    })
  );
}

function getSecondsUntil(endAt: number) {
  return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
}

function hasLog(logs: LogEntry[], message: string) {
  return logs.some((log) => log.message === message);
}

export function LostCountdownClient() {
  const [endAt, setEndAt] = useState(() => Date.now() + INITIAL_SECONDS * 1000);
  const [secondsRemaining, setSecondsRemaining] = useState(INITIAL_SECONDS);
  const [sequenceFields, setSequenceFields] = useState<string[]>(() => SEQUENCE.map(() => ""));
  const [status, setStatus] = useState(LOCKED_STATUS);
  const [failure, setFailure] = useState(false);
  const [lastResetAt, setLastResetAt] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [successPulse, setSuccessPulse] = useState(false);
  const [failureFlash, setFailureFlash] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const expiredLoggedRef = useRef(false);

  const inputEnabled = secondsRemaining <= FINAL_WINDOW_SECONDS && secondsRemaining > 0 && !failure;
  const finalThirtySeconds = secondsRemaining <= 30 && secondsRemaining > 0 && !failure;
  const finalMinute = secondsRemaining <= 60 && secondsRemaining > 0 && !failure;
  const finalTwoMinutes = secondsRemaining <= 120 && secondsRemaining > 0 && !failure;
  const warning = inputEnabled && !finalTwoMinutes && !failure;
  const terminalState = failure
    ? "failure"
    : finalThirtySeconds
      ? "heartbeat"
      : finalMinute
      ? "critical"
      : finalTwoMinutes
        ? "danger"
        : warning
          ? "warning"
          : "normal";

  const displayValue = useMemo(() => formatCountdown(secondsRemaining), [secondsRemaining]);

  function persistState(nextState: StoredLostState) {
    setEndAt(nextState.endAt);
    setFailure(nextState.failure);
    setLastResetAt(nextState.lastResetAt);
    setLogs(nextState.logs.slice(0, 20));
    setStatus(nextState.status);
    setSecondsRemaining(nextState.failure ? 0 : getSecondsUntil(nextState.endAt));
    expiredLoggedRef.current = nextState.failure;
    writeStoredState(nextState);
  }

  function updateStoredState(updater: (current: StoredLostState) => StoredLostState) {
    const current: StoredLostState = {
      endAt,
      failure,
      lastResetAt,
      logs,
      status,
    };
    persistState(updater(current));
  }

  function addLog(message: string) {
    updateStoredState((current) => ({
      ...current,
      logs: [createLog(message), ...current.logs].slice(0, 20),
    }));
  }

  function jumpTo(seconds: number, logMessage: string, nextStatus: string) {
    const now = Date.now();
    updateStoredState((current) => ({
      ...current,
      endAt: now + seconds * 1000,
      failure: false,
      status: nextStatus,
      logs: [createLog(logMessage, now), ...current.logs].slice(0, 20),
    }));
    setSequenceFields(SEQUENCE.map(() => ""));
    setOverrideOpen(false);
    window.setTimeout(() => inputRefs.current[0]?.focus(), 0);
  }

  function triggerFailure(message = "Failure triggered.") {
    updateStoredState((current) => ({
      ...current,
      endAt: Date.now(),
      failure: true,
      status: "SYSTEM FAILURE",
      logs: [createLog(message), ...current.logs].slice(0, 20),
    }));
    setOverrideOpen(false);
  }

  function resetCountdownFromOverride() {
    persistState(resetStateWithLog("System reset."));
    setSequenceFields(SEQUENCE.map(() => ""));
    setOverrideOpen(false);
  }

  useEffect(() => {
    const hasActiveBrowserSession = window.sessionStorage.getItem(SESSION_KEY) === "active";
    window.sessionStorage.setItem(SESSION_KEY, "active");

    if (!hasActiveBrowserSession) {
      persistState(createInitialState());
      setInitialized(true);
      return;
    }

    const storedState = readStoredState();
    if (!storedState) {
      persistState(createInitialState());
      setInitialized(true);
      return;
    }

    if (!storedState.failure && storedState.endAt <= Date.now()) {
      persistState({
        ...storedState,
        failure: true,
        status: "SYSTEM FAILURE",
        logs: [createLog("Timer expired."), ...storedState.logs].slice(0, 20),
      });
      setInitialized(true);
      return;
    }

    persistState({
      ...storedState,
      logs: [createLog("Manual page restart."), ...storedState.logs].slice(0, 20),
    });
    setInitialized(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!initialized || failure) return;

    const timer = window.setInterval(() => {
      const nextSeconds = getSecondsUntil(endAt);
      setSecondsRemaining(nextSeconds);

      if (nextSeconds <= 0 && !expiredLoggedRef.current) {
        expiredLoggedRef.current = true;
        updateStoredState((current) => ({
          ...current,
          failure: true,
          status: "SYSTEM FAILURE",
          logs: [createLog("Timer expired."), ...current.logs].slice(0, 20),
        }));
      }
    }, 1000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endAt, failure, initialized]);

  useEffect(() => {
    if (!initialized || failure || secondsRemaining <= 0) return;

    if (secondsRemaining <= 60) {
      if (hasLog(logs, "System failure imminent.")) return;

      updateStoredState((current) => ({
        ...current,
        status:
          current.status === "Incorrect sequence." || current.status === "System reset successful."
            ? current.status
            : FINAL_MINUTE_STATUS,
        logs: hasLog(current.logs, "System failure imminent.")
          ? current.logs
          : [createLog("System failure imminent."), ...current.logs].slice(0, 20),
      }));
      return;
    }

    if (secondsRemaining <= FINAL_WINDOW_SECONDS) {
      if (hasLog(logs, "Final four minute protocol active.")) return;

      updateStoredState((current) => ({
        ...current,
        status:
          current.status === LOCKED_STATUS ||
          current.status === FINAL_MINUTE_STATUS ||
          current.status === FINAL_FOUR_STATUS
            ? FINAL_FOUR_STATUS
            : current.status,
        logs: hasLog(current.logs, "Final four minute protocol active.")
          ? current.logs
          : [createLog("Final four minute protocol active."), ...current.logs].slice(0, 20),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure, initialized, logs, secondsRemaining, status]);

  useEffect(() => {
    if (!initialized) return;

    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyL") {
        event.preventDefault();
        setOverrideOpen(true);
        addLog("Maintenance override detected.");
        return;
      }

      if (!event.shiftKey || !event.altKey) return;

      if (event.code === "Digit4") {
        event.preventDefault();
        jumpTo(240, "Test override: final four minutes activated.", FINAL_FOUR_STATUS);
      }

      if (event.code === "Digit1") {
        event.preventDefault();
        jumpTo(60, "Test override: final minute activated.", FINAL_MINUTE_STATUS);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized]);

  function resetSystem(message = "System reset successful.") {
    const now = Date.now();
    persistState({
      endAt: now + INITIAL_SECONDS * 1000,
      failure: false,
      lastResetAt: now,
      logs: [createLog("Sequence accepted. Timer reset.", now), ...logs].slice(0, 20),
      status: message,
    });
    setSequenceFields(SEQUENCE.map(() => ""));
    setSuccessPulse(true);
    window.setTimeout(() => setSuccessPulse(false), 900);
  }

  function handleFieldChange(index: number, value: string) {
    if (!inputEnabled) return;

    const normalized = value.replace(/\D/g, "").slice(0, 2);
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
      return;
    }

    updateStoredState((current) => ({
      ...current,
      status: "Incorrect sequence.",
      logs: [createLog("Sequence rejected."), ...current.logs].slice(0, 20),
    }));
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
                      <div className="w-full overflow-hidden border-y border-red-400/30 bg-black/45 py-3 font-mono text-5xl text-red-100 drop-shadow-[0_0_18px_rgba(248,113,113,0.78)] sm:text-7xl">
                        <div className="animate-[marquee_8s_linear_infinite] whitespace-nowrap">
                          {[...FAILURE_SYMBOLS, ...FAILURE_SYMBOLS, ...FAILURE_SYMBOLS].join("   ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="rounded-[14px] border border-red-200/55 bg-red-500/24 px-6 py-4 font-mono text-sm font-semibold uppercase tracking-[0.22em] text-red-50 shadow-[0_0_24px_rgba(248,113,113,0.28)] transition hover:bg-red-500/34"
                        onClick={() => {
                          persistState(resetStateWithLog("System reset."));
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
                  onClick={() => setSoundMuted((current) => !current)}
                >
                  <span aria-hidden="true">{soundMuted ? "🔇" : "🔊"}</span>
                  {soundMuted ? "Audio muted" : "Audio armed"}
                </button>
                {/* TODO: Wire local warning/alarm audio files when assets are available. */}

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
                onClick={() => jumpTo(240, "Test override: final four minutes activated.", FINAL_FOUR_STATUS)}
              >
                Activate Final Four Minute Protocol
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-red-300/30 bg-red-500/12 px-4 py-3 text-left text-sm uppercase tracking-[0.12em] transition hover:bg-red-500/20"
                onClick={() => triggerFailure("Failure triggered.")}
              >
                Trigger System Failure
              </button>
              <button
                type="button"
                className="rounded-[12px] border border-lime-200/25 bg-lime-300/10 px-4 py-3 text-left text-sm uppercase tracking-[0.12em] transition hover:bg-lime-300/16"
                onClick={resetCountdownFromOverride}
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
        @keyframes marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-33.333%);
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
