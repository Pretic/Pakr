import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const SCRIPT_PATH = "app/src/main/assets/pakr_element_blocker.js";

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.ownerDocument = document;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.eventListeners = new Map();
    this.classList = [];
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.innerText = "";
    this.disabled = false;
    this.rect = { left: 0, top: 0, width: 160, height: 220, right: 160, bottom: 220 };
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
    this.eventListeners.get(type).push(listener);
  }

  closest(selector) {
    if (selector !== "[data-pakr-ui='1']") return null;
    let node = this;
    while (node) {
      if (node.dataset && node.dataset.pakrUi === "1") return node;
      node = node.parentElement;
    }
    return null;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  getAttribute(name) {
    return this.attributes[name] || "";
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
  }

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.body);
    this.target = new FakeElement("div", this);
    this.target.innerText = "Readable text";
    this.body.appendChild(this.target);
    this.pointStack = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(type, this.listeners.get(type).filter((item) => item !== listener));
  }

  dispatch(type, event) {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
    }
  }

  getElementById(id) {
    return this.walk().find((element) => element.id === id) || null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll(selector) {
    if (selector !== "[data-pakr-ui='1']") return [];
    return this.walk().filter((element) => element.dataset && element.dataset.pakrUi === "1");
  }

  elementFromPoint() {
    return this.pointStack ? this.pointStack[0] : this.target;
  }

  elementsFromPoint() {
    return this.pointStack || [this.target, this.body, this.documentElement];
  }

  walk(root = this.documentElement) {
    return [root, ...root.children.flatMap((child) => this.walk(child))];
  }
}

function createFixture() {
  const document = new FakeDocument();
  const timerQueue = new Map();
  let nextTimerId = 1;

  const context = {
    document,
    location: { hostname: "example.com", href: "https://example.com/page" },
    innerWidth: 800,
    innerHeight: 600,
    CSS: { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "_") },
    getComputedStyle: () => ({ backgroundImage: "none" }),
    setTimeout: (callback, delay = 0) => {
      const id = nextTimerId++;
      timerQueue.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => {
      timerQueue.delete(id);
    },
    PakrElementBlocker: {
      getRules: () => "[]",
      saveRules: () => {},
      getFontScale: () => "normal",
      applyFontScale: () => {},
      toast: () => {},
      previewImage: () => {}
    }
  };
  context.window = context;
  vm.runInNewContext(readFileSync(SCRIPT_PATH, "utf8"), context, { filename: SCRIPT_PATH });

  return {
    context,
    document,
    runTimersThrough(maxDelay) {
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const [id, timer] of [...timerQueue.entries()].sort((a, b) => a[1].delay - b[1].delay)) {
          if (timer.delay <= maxDelay) {
            timerQueue.delete(id);
            timer.callback();
            progressed = true;
          }
        }
      }
    },
    menuCount() {
      return document.walk().filter((element) => element.className === "pakr-blocker-menu").length;
    },
    menuButtonCount() {
      const menu = document.walk().find((element) => element.className === "pakr-blocker-menu");
      return menu ? menu.children.filter((element) => element.tagName === "BUTTON").length : 0;
    }
  };
}

function touchEvent(target, x, y) {
  return {
    target,
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    preventDefault: () => {},
    stopPropagation: () => {}
  };
}

test("touch long press tolerates slight finger drift before opening the menu", () => {
  const fixture = createFixture();
  fixture.document.dispatch("touchstart", touchEvent(fixture.document.target, 100, 140));
  fixture.document.dispatch("touchmove", touchEvent(fixture.document.target, 106, 144));

  fixture.runTimersThrough(650);

  assert.equal(fixture.menuCount(), 1);
});

test("touch long press menu stays open after the synthesized click on release", () => {
  const fixture = createFixture();
  fixture.document.dispatch("touchstart", touchEvent(fixture.document.target, 100, 140));

  fixture.runTimersThrough(650);
  fixture.document.dispatch("touchend", touchEvent(fixture.document.target, 100, 140));
  fixture.document.dispatch("click", touchEvent(fixture.document.target, 100, 140));

  assert.equal(fixture.menuCount(), 1);
});

test("native entry resolves through broad containers to a specific content target", () => {
  const fixture = createFixture();
  const broad = new FakeElement("div", fixture.document);
  broad.className = "broad-container";
  broad.rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
  fixture.document.body.appendChild(broad);
  fixture.document.pointStack = [broad, fixture.document.target, fixture.document.body, fixture.document.documentElement];

  assert.equal(fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180), true);

  assert.equal(fixture.menuButtonCount(), 5);
});

test("native entry can open the menu at WebView coordinates", () => {
  const fixture = createFixture();

  assert.equal(typeof fixture.context.window.PakrElementBlockerUI.openMenuAt, "function");
  assert.equal(fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180), true);

  assert.equal(fixture.menuCount(), 1);
});
