import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { LostAudioController } from "../app/lost/lost-audio-controller.ts";

class FakeBufferSource {
  constructor() {
    this.buffer = null;
    this.connectedTo = null;
    this.disconnected = false;
    this.onended = null;
    this.started = false;
    this.stopped = false;
  }

  connect(target) {
    this.connectedTo = target;
  }

  disconnect() {
    this.disconnected = true;
  }

  start() {
    this.started = true;
  }

  stop() {
    this.stopped = true;
  }
}

class FakeGain {
  constructor() {
    this.gain = { value: 1 };
    this.connectedTo = null;
    this.disconnected = false;
  }

  connect(target) {
    this.connectedTo = target;
  }

  disconnect() {
    this.disconnected = true;
  }
}

class FakeAudioContext {
  constructor(state = "running") {
    this.state = state;
    this.destination = {};
    this.sources = [];
    this.gains = [];
    this.decodeCalls = 0;
    this.resumeCalls = 0;
    this.closeCalls = 0;
  }

  async resume() {
    this.resumeCalls += 1;
    this.state = "running";
  }

  async close() {
    this.closeCalls += 1;
    this.state = "closed";
  }

  async decodeAudioData() {
    this.decodeCalls += 1;
    return { decoded: true };
  }

  createBufferSource() {
    const source = new FakeBufferSource();
    this.sources.push(source);
    return source;
  }

  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
}

function createController(context, loadArrayBuffer = async () => new ArrayBuffer(1)) {
  return new LostAudioController({
    createContext: () => context,
    loadArrayBuffer,
  });
}

test("LOST audio uses Web Audio without registering global media controls", async () => {
  const controllerSource = await readFile(
    new URL("../app/lost/lost-audio-controller.ts", import.meta.url),
    "utf8"
  );
  const providerSource = await readFile(
    new URL("../app/lost/lost-timer-provider.tsx", import.meta.url),
    "utf8"
  );
  const combinedSource = `${controllerSource}\n${providerSource}`;

  assert.doesNotMatch(combinedSource, /\bnew\s+Audio\s*\(/);
  assert.doesNotMatch(combinedSource, /HTMLAudioElement|HTMLMediaElement/);
  assert.doesNotMatch(combinedSource, /mediaSession|setActionHandler|MediaMetadata/);
  assert.match(controllerSource, /createBufferSource\(\)/);
});

test("arming audio resumes its AudioContext from the user interaction", async () => {
  const context = new FakeAudioContext("suspended");
  const controller = createController(context);

  await controller.unlock();

  assert.equal(context.resumeCalls, 1);
  assert.equal(context.state, "running");
});

test("sound buffers are decoded once and replayed through independent Web Audio sources", async () => {
  const context = new FakeAudioContext();
  const loadedUrls = [];
  const controller = createController(context, async (url) => {
    loadedUrls.push(url);
    return new ArrayBuffer(1);
  });

  await controller.play("tick");
  const firstSource = context.sources[0];
  await controller.play("tick", { restart: true });
  const secondSource = context.sources[1];

  assert.deepEqual(loadedUrls, ["/sounds/lost/tick.mp3"]);
  assert.equal(context.decodeCalls, 1);
  assert.equal(firstSource.started, true);
  assert.equal(firstSource.stopped, true);
  assert.equal(firstSource.disconnected, true);
  assert.equal(secondSource.started, true);
  assert.equal(context.gains[0].gain.value, 0.36);
});

test("stopping a pending sound prevents it starting after decoding finishes", async () => {
  const context = new FakeAudioContext();
  let releaseLoad;
  const loadStarted = new Promise((resolve) => {
    releaseLoad = resolve;
  });
  let finishLoad;
  const pendingLoad = new Promise((resolve) => {
    finishLoad = resolve;
  });
  const controller = createController(context, async () => {
    releaseLoad();
    return pendingLoad;
  });

  const playback = controller.play("systemfailure");
  await loadStarted;
  controller.stop("systemfailure");
  finishLoad(new ArrayBuffer(1));
  await playback;

  assert.equal(context.sources.length, 0);
});

test("reset cleanup stops every active sound without closing the reusable context", async () => {
  const context = new FakeAudioContext();
  const controller = createController(context);

  await controller.play("tick");
  await controller.play("systemfailure");
  controller.stopAll();

  assert.equal(context.sources.length, 2);
  assert.ok(context.sources.every((source) => source.stopped));
  assert.ok(context.sources.every((source) => source.disconnected));
  assert.equal(context.closeCalls, 0);
});

test("unmount cleanup stops playback, closes the context, and prevents later playback", async () => {
  const context = new FakeAudioContext();
  const controller = createController(context);

  await controller.play("alarm");
  await controller.dispose();
  await controller.play("alarm");

  assert.equal(context.sources.length, 1);
  assert.equal(context.sources[0].stopped, true);
  assert.equal(context.closeCalls, 1);
  assert.equal(context.state, "closed");
});

test("failure transition explicitly cleans up countdown audio first", async () => {
  const providerSource = await readFile(
    new URL("../app/lost/lost-timer-provider.tsx", import.meta.url),
    "utf8"
  );
  const failureEffect = providerSource.slice(
    providerSource.indexOf("if (!initialized || !failure)"),
    providerSource.indexOf("if (!initialized || !failure)", providerSource.indexOf("if (!initialized || !failure)") + 1)
  );

  assert.match(failureEffect, /stopCountdownAudio\(\)/);
  assert.ok(
    failureEffect.indexOf("stopCountdownAudio()") < failureEffect.indexOf('playSound("timeout"'),
    "countdown audio must stop before failure audio starts"
  );
});
