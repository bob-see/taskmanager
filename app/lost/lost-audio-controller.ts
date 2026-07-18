export type LostSoundName =
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

const LOST_SOUND_BASE = "/sounds/lost";

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

type ActiveSound = {
  source: AudioBufferSourceNode;
  gain: GainNode;
};

type LostAudioControllerOptions = {
  createContext?: () => AudioContext | null;
  loadArrayBuffer?: (url: string) => Promise<ArrayBuffer>;
};

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not load LOST sound: ${response.status}`);
  }
  return response.arrayBuffer();
}

export class LostAudioController {
  private readonly createContext: () => AudioContext | null;
  private readonly loadArrayBuffer: (url: string) => Promise<ArrayBuffer>;
  private context: AudioContext | null = null;
  private buffers = new Map<LostSoundName, Promise<AudioBuffer>>();
  private active = new Map<LostSoundName, ActiveSound>();
  private pending = new Map<LostSoundName, number>();
  private generations = new Map<LostSoundName, number>();
  private disposed = false;

  constructor(options: LostAudioControllerOptions = {}) {
    this.createContext =
      options.createContext ??
      (() => (typeof AudioContext === "undefined" ? null : new AudioContext()));
    this.loadArrayBuffer = options.loadArrayBuffer ?? fetchArrayBuffer;
  }

  async unlock() {
    const context = this.getContext();
    if (context?.state === "suspended") {
      await context.resume();
    }
  }

  async play(name: LostSoundName, options: { restart?: boolean } = {}) {
    if (this.disposed) return;

    if (options.restart) {
      this.stop(name);
    } else if (this.active.has(name) || this.pending.has(name)) {
      return;
    }

    const context = this.getContext();
    if (!context) return;

    const generation = (this.generations.get(name) ?? 0) + 1;
    this.generations.set(name, generation);
    this.pending.set(name, generation);

    try {
      if (context.state === "suspended") {
        await context.resume();
      }

      const buffer = await this.getBuffer(name, context);
      if (
        this.disposed ||
        this.generations.get(name) !== generation ||
        context.state === "closed"
      ) {
        return;
      }

      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = LOST_SOUND_VOLUMES[name] ?? 0.65;
      source.connect(gain);
      gain.connect(context.destination);

      const activeSound = { source, gain };
      this.active.set(name, activeSound);
      source.onended = () => {
        if (this.active.get(name) === activeSound) {
          this.active.delete(name);
        }
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    } finally {
      if (this.pending.get(name) === generation) {
        this.pending.delete(name);
      }
    }
  }

  stop(name: LostSoundName) {
    this.generations.set(name, (this.generations.get(name) ?? 0) + 1);
    this.pending.delete(name);

    const activeSound = this.active.get(name);
    if (!activeSound) return;

    this.active.delete(name);
    activeSound.source.onended = null;
    try {
      activeSound.source.stop();
    } catch {
      // The source may already have ended between lookup and cleanup.
    }
    activeSound.source.disconnect();
    activeSound.gain.disconnect();
  }

  stopAll() {
    for (const name of Object.keys(LOST_SOUND_FILES) as LostSoundName[]) {
      this.stop(name);
    }
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.stopAll();
    this.buffers.clear();

    const context = this.context;
    this.context = null;
    if (context && context.state !== "closed") {
      await context.close();
    }
  }

  private getContext() {
    if (this.disposed) return null;
    this.context ??= this.createContext();
    return this.context;
  }

  private getBuffer(name: LostSoundName, context: AudioContext) {
    const existing = this.buffers.get(name);
    if (existing) return existing;

    const bufferPromise = this.loadArrayBuffer(
      `${LOST_SOUND_BASE}/${LOST_SOUND_FILES[name]}`
    )
      .then((encodedAudio) => context.decodeAudioData(encodedAudio))
      .catch((error) => {
        this.buffers.delete(name);
        throw error;
      });
    this.buffers.set(name, bufferPromise);
    return bufferPromise;
  }
}
