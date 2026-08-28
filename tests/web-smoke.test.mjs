import assert from "node:assert/strict";

class FakeClassList {
  values = new Set();
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeElement {
  constructor() {
    this.hidden = false;
    this.textContent = "";
    this.classList = new FakeClassList();
    this.listeners = new Map();
    this.width = 540;
    this.height = 960;
  }
  addEventListener(name, listener) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(listener);
  }
  dispatch(name, details = {}) {
    for (const listener of this.listeners.get(name) || []) {
      listener({ preventDefault() {}, pointerId: 1, clientX: 0, code: "", repeat: false, ...details });
    }
  }
  setAttribute() {}
  setPointerCapture() {}
  getBoundingClientRect() { return { width: 540, height: 960 }; }
}

const selectors = [
  "#gameCanvas", "#menuOverlay", "#pauseOverlay", "#gameOverOverlay", "#driveControls",
  "#startButton", "#restartButton", "#resumeButton", "#leftButton", "#rightButton",
  "#brakeButton", "#pauseButton", "#soundButton", "#menuBest", "#finalScore",
  "#finalDistance", "#finalFare", "#finalBest", "#gameOverReason", "#status",
];
const elements = new Map(selectors.map((selector) => [selector, new FakeElement()]));

const fakeContext = new Proxy({
  createLinearGradient() { return { addColorStop() {} }; },
}, {
  get(target, property) {
    if (property in target) return target[property];
    if (typeof property === "symbol") return undefined;
    return () => {};
  },
  set(target, property, value) {
    target[property] = value;
    return true;
  },
});

elements.get("#gameCanvas").getContext = () => fakeContext;

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener() {},
  AudioContext: class {
    state = "running";
    currentTime = 0;
    resume() { return Promise.resolve(); }
    createOscillator() {
      return { frequency: { setValueAtTime() {} }, connect() { return this; }, start() {}, stop() {} };
    }
    createGain() {
      return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() { return this; } };
    }
    get destination() { return {}; }
  },
};
globalThis.document = {
  hidden: false,
  querySelector(selector) { return elements.get(selector); },
  addEventListener() {},
};
Object.defineProperty(globalThis, "navigator", { value: {}, configurable: true });
Object.defineProperty(globalThis, "location", { value: { protocol: "file:" }, configurable: true });
Object.defineProperty(globalThis, "localStorage", { value: {
  values: new Map(),
  getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, value); },
}, configurable: true });
globalThis.requestAnimationFrame = () => 1;

await import("../web-preview/game.js");

assert.equal(elements.get("#pauseButton").hidden, true, "pause starts hidden on the menu");
assert.match(elements.get("#menuBest").textContent, /^Best score:/);

elements.get("#startButton").dispatch("click");
assert.equal(elements.get("#menuOverlay").hidden, true, "start closes the menu");
assert.equal(elements.get("#driveControls").hidden, false, "start reveals mobile controls");
assert.equal(elements.get("#pauseButton").hidden, false, "start reveals pause control");

elements.get("#pauseButton").dispatch("click");
assert.equal(elements.get("#pauseOverlay").hidden, false, "pause opens the pause overlay");
assert.equal(elements.get("#driveControls").hidden, true, "pause hides drive controls");

elements.get("#resumeButton").dispatch("click");
assert.equal(elements.get("#pauseOverlay").hidden, true, "resume closes pause overlay");
assert.equal(elements.get("#driveControls").hidden, false, "resume restores drive controls");

console.log("Jeepney Dash web smoke test passed.");
