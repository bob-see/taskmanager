"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export const INITIAL_SECONDS = 108 * 60;
export const FINAL_WINDOW_SECONDS = 4 * 60;
export const SEQUENCE = ["4", "8", "15", "16", "23", "42"] as const;
export const FAILURE_SYMBOLS = ["𓂀", "𓊽", "𓆣", "𓃭", "𓏏", "𓇳", "𓁹", "𓎛"];
export const LOCKED_STATUS = "Input remains locked until the final four minutes.";
export const FINAL_FOUR_STATUS = "ENTER THE NUMBERS";
export const FINAL_MINUTE_STATUS = "SYSTEM FAILURE IMMINENT";
export const LOST_GLYPH_IDS = [1, 2, 3, 4, 5] as const;

const STORAGE_KEY = "tm-lost-countdown-state-v3";
const SESSION_KEY = "tm-lost-countdown-browser-session-v3";
const LOST_SOUND_BASE = "/sounds/lost";
const FAILURE_AUDIO_THUD_DELAY_MS = 5200;
const GLYPH_SPIN_INTERVAL_MS = 115;
const GLYPH_LOCK_DELAYS_MS = [900, 1450, 2050, 2900, 3900] as const;

type LostSoundName =
  | "alarm"
  | "beep"
  | "discharge"
  | "keypress"
  | "reset"
  | "spinup"
  | "systemfailure"
  | "thud"
  | "tick"
  | "timeout";

const LOST_SOUND_FILES: Record<LostSoundName, string> = {
  alarm: "alarm.mp3",
  beep: "beep.mp3",
  discharge: "discharge.mp3",
  keypress: "keypress.mp3",
  reset: "reset.mp3",
  spinup: "spinup.mp3",
  systemfailure: "systemfailure.mp3",
  thud: "thud.mp3",
  tick: "tick.mp3",
  timeout: "timeout.mp3",
};

const LOST_SOUND_VOLUMES: Partial<Record<LostSoundName, number>> = {
  alarm: 0.74,
  beep: 0.55,
  keypress: 0.45,
  systemfailure: 0.78,
  tick: 0.36,
};

export type LostTerminalState =
  | "failure"
  | "heartbeat"
  | "critical"
  | "danger"
  | "warning"
  | "normal";

export type LogEntry = {
  id: string;
  message: string;
  timestamp: number;
};

export type LostGlyphId = (typeof LOST_GLYPH_IDS)[number];
export type LostGlyphTone = "red" | "black";

export type LostGlyphSlot = {
  glyph: LostGlyphId;
  tone: LostGlyphTone;
  locked: boolean;
};

type StoredLostState = {
  endAt: number;
  failure: boolean;
  lastResetAt: number | null;
  logs: LogEntry[];
  status: string;
};

type LostTimerContextValue = {
  initialized: boolean;
  secondsRemaining: number;
  status: string;
  failure: boolean;
  lastResetAt: number | null;
  logs: LogEntry[];
  glyphSlots: LostGlyphSlot[];
  successPulse: boolean;
  failureWhiteFlash: boolean;
  overrideOpen: boolean;
  setOverrideOpen: (open: boolean) => void;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  inputEnabled: boolean;
  terminalState: LostTerminalState;
  displayValue: string;
  addLog: (message: string) => void;
  jumpTo: (seconds: number, logMessage: string, nextStatus: string) => void;
  triggerFailure: (message?: string) => void;
  resetCountdownFromOverride: () => void;
  resetSystem: (message?: string) => void;
  rejectSequence: () => void;
  playKeypress: () => void;
};

class LostAudioController {
  private sounds = new Map<LostSoundName, HTMLAudioElement>();

  play(name: LostSoundName, options: { restart?: boolean } = {}) {
    const audio = this.getSound(name);
    if (!audio) return;

    if (options.restart) {
      audio.pause();
      audio.currentTime = 0;
    } else if (!audio.paused && !audio.ended) {
      return;
    }

    void audio.play().catch(() => {
      // Browsers can block playback until the user interacts with the page.
    });
  }

  stop(name: LostSoundName) {
    const audio = this.sounds.get(name);
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }

  stopAll() {
    for (const audio of this.sounds.values()) {
      audio.pause();
      audio.currentTime = 0;
    }
  }

  private getSound(name: LostSoundName) {
    if (typeof Audio === "undefined") return null;

    const existing = this.sounds.get(name);
    if (existing) return existing;

    const audio = new Audio(`${LOST_SOUND_BASE}/${LOST_SOUND_FILES[name]}`);
    audio.preload = "auto";
    audio.volume = LOST_SOUND_VOLUMES[name] ?? 0.65;
    this.sounds.set(name, audio);
    return audio;
  }
}

const LostTimerContext = createContext<LostTimerContextValue | null>(null);

export function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatLogTime(timestamp: number) {
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

function getGlyphTone(index: number): LostGlyphTone {
  return index < 3 ? "red" : "black";
}

function getRandomGlyph(): LostGlyphId {
  return LOST_GLYPH_IDS[Math.floor(Math.random() * LOST_GLYPH_IDS.length)];
}

function createGlyphSlots(locked = false): LostGlyphSlot[] {
  return LOST_GLYPH_IDS.map((glyph, index) => ({
    glyph: locked ? glyph : getRandomGlyph(),
    tone: getGlyphTone(index),
    locked,
  }));
}

export function LostTimerProvider({ children }: { children: ReactNode }) {
  const [endAt, setEndAt] = useState(() => Date.now() + INITIAL_SECONDS * 1000);
  const [secondsRemaining, setSecondsRemaining] = useState(INITIAL_SECONDS);
  const [status, setStatus] = useState(LOCKED_STATUS);
  const [failure, setFailure] = useState(false);
  const [lastResetAt, setLastResetAt] = useState<number | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [glyphSlots, setGlyphSlots] = useState<LostGlyphSlot[]>(() => createGlyphSlots());
  const [successPulse, setSuccessPulse] = useState(false);
  const [failureWhiteFlash, setFailureWhiteFlash] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const expiredLoggedRef = useRef(false);
  const audioRef = useRef<LostAudioController | null>(null);
  const previousSoundSecondRef = useRef<number | null>(null);
  const timeoutSoundPlayedRef = useRef(false);
  const failureAudioStartedRef = useRef(false);
  const failureStartTimeoutRef = useRef<number | null>(null);
  const systemFailureIntervalRef = useRef<number | null>(null);
  const failureThudTimeoutRef = useRef<number | null>(null);
  const glyphSpinIntervalRef = useRef<number | null>(null);
  const glyphLockTimeoutRefs = useRef<number[]>([]);

  const inputEnabled = secondsRemaining <= FINAL_WINDOW_SECONDS && secondsRemaining > 0 && !failure;
  const finalThirtySeconds = secondsRemaining <= 30 && secondsRemaining > 0 && !failure;
  const finalMinute = secondsRemaining <= 60 && secondsRemaining > 0 && !failure;
  const finalTwoMinutes = secondsRemaining <= 120 && secondsRemaining > 0 && !failure;
  const warning = inputEnabled && !finalTwoMinutes && !failure;
  const terminalState: LostTerminalState = failure
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

  function getAudio() {
    audioRef.current ??= new LostAudioController();
    return audioRef.current;
  }

  function playSound(name: LostSoundName, options: { restart?: boolean } = {}) {
    if (soundMuted) return;
    getAudio().play(name, options);
  }

  function stopFailureAudio() {
    if (systemFailureIntervalRef.current !== null) {
      window.clearInterval(systemFailureIntervalRef.current);
      systemFailureIntervalRef.current = null;
    }

    if (failureStartTimeoutRef.current !== null) {
      window.clearTimeout(failureStartTimeoutRef.current);
      failureStartTimeoutRef.current = null;
    }

    if (failureThudTimeoutRef.current !== null) {
      window.clearTimeout(failureThudTimeoutRef.current);
      failureThudTimeoutRef.current = null;
    }

    audioRef.current?.stop("systemfailure");
    failureAudioStartedRef.current = false;
    setFailureWhiteFlash(false);
  }

  function stopGlyphSequence() {
    if (glyphSpinIntervalRef.current !== null) {
      window.clearInterval(glyphSpinIntervalRef.current);
      glyphSpinIntervalRef.current = null;
    }

    for (const timeout of glyphLockTimeoutRefs.current) {
      window.clearTimeout(timeout);
    }
    glyphLockTimeoutRefs.current = [];
  }

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
    setOverrideOpen(false);
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
    stopFailureAudio();
    persistState(resetStateWithLog("System reset."));
    setOverrideOpen(false);
  }

  function resetSystem(message = "System reset successful.") {
    const now = Date.now();
    stopFailureAudio();
    playSound("reset", { restart: true });
    persistState({
      endAt: now + INITIAL_SECONDS * 1000,
      failure: false,
      lastResetAt: now,
      logs: [createLog("Sequence accepted. Timer reset.", now), ...logs].slice(0, 20),
      status: message,
    });
    setSuccessPulse(true);
    window.setTimeout(() => setSuccessPulse(false), 900);
  }

  function rejectSequence() {
    updateStoredState((current) => ({
      ...current,
      status: "Incorrect sequence.",
      logs: [createLog("Sequence rejected."), ...current.logs].slice(0, 20),
    }));
  }

  function playKeypress() {
    playSound("keypress", { restart: true });
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
  }, []);

  useEffect(() => {
    return () => {
      stopGlyphSequence();
      stopFailureAudio();
      audioRef.current?.stopAll();
    };
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
    if (!initialized || failure) return;

    if (secondsRemaining > 0) {
      timeoutSoundPlayedRef.current = false;
    }

    if (
      soundMuted ||
      secondsRemaining <= 0 ||
      secondsRemaining >= FINAL_WINDOW_SECONDS ||
      previousSoundSecondRef.current === secondsRemaining
    ) {
      return;
    }

    previousSoundSecondRef.current = secondsRemaining;
    playSound("tick", { restart: true });

    if (secondsRemaining <= 60) {
      if (secondsRemaining < 10 || secondsRemaining % 2 === 0) {
        playSound("alarm", { restart: true });
      }
      return;
    }

    if (secondsRemaining % 2 === 0) {
      playSound("beep", { restart: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure, initialized, secondsRemaining, soundMuted]);

  useEffect(() => {
    if (!initialized || !failure) {
      if (!failure) {
        stopFailureAudio();
      }
      return;
    }

    if (!timeoutSoundPlayedRef.current) {
      timeoutSoundPlayedRef.current = true;
      playSound("timeout", { restart: true });
    }

    if (soundMuted) {
      stopFailureAudio();
      return;
    }

    if (failureAudioStartedRef.current) return;

    failureAudioStartedRef.current = true;
    failureStartTimeoutRef.current = window.setTimeout(() => {
      playSound("spinup", { restart: true });
      playSound("discharge", { restart: true });
      playSound("systemfailure", { restart: true });

      systemFailureIntervalRef.current = window.setInterval(() => {
        playSound("systemfailure", { restart: true });
      }, 1800);
    }, 350);

    failureThudTimeoutRef.current = window.setTimeout(() => {
      setFailureWhiteFlash(true);
      playSound("thud", { restart: true });
      window.setTimeout(() => setFailureWhiteFlash(false), 420);

      if (systemFailureIntervalRef.current !== null) {
        window.clearInterval(systemFailureIntervalRef.current);
        systemFailureIntervalRef.current = null;
      }
    }, FAILURE_AUDIO_THUD_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failure, initialized, soundMuted]);

  useEffect(() => {
    if (!initialized || !failure) {
      stopGlyphSequence();
      setGlyphSlots(createGlyphSlots());
      return;
    }

    stopGlyphSequence();
    setGlyphSlots(createGlyphSlots());

    glyphSpinIntervalRef.current = window.setInterval(() => {
      setGlyphSlots((current) =>
        current.map((slot) => (slot.locked ? slot : { ...slot, glyph: getRandomGlyph() }))
      );
    }, GLYPH_SPIN_INTERVAL_MS);

    glyphLockTimeoutRefs.current = GLYPH_LOCK_DELAYS_MS.map((delay, index) =>
      window.setTimeout(() => {
        setGlyphSlots((current) =>
          current.map((slot, slotIndex) =>
            slotIndex === index
              ? {
                  ...slot,
                  glyph: LOST_GLYPH_IDS[slotIndex],
                  locked: true,
                }
              : slot
          )
        );

        if (index === GLYPH_LOCK_DELAYS_MS.length - 1 && glyphSpinIntervalRef.current !== null) {
          window.clearInterval(glyphSpinIntervalRef.current);
          glyphSpinIntervalRef.current = null;
        }
      }, delay)
    );

    return stopGlyphSequence;
  }, [failure, initialized]);

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

  const value: LostTimerContextValue = {
    initialized,
    secondsRemaining,
    status,
    failure,
    lastResetAt,
    logs,
    glyphSlots,
    successPulse,
    failureWhiteFlash,
    overrideOpen,
    setOverrideOpen,
    soundMuted,
    setSoundMuted,
    inputEnabled,
    terminalState,
    displayValue,
    addLog,
    jumpTo,
    triggerFailure,
    resetCountdownFromOverride,
    resetSystem,
    rejectSequence,
    playKeypress,
  };

  return <LostTimerContext.Provider value={value}>{children}</LostTimerContext.Provider>;
}

export function useLostTimer() {
  const context = useContext(LostTimerContext);
  if (!context) {
    throw new Error("useLostTimer must be used within LostTimerProvider");
  }
  return context;
}
